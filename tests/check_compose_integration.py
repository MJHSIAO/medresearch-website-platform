"""Validate the override against a supplied server Compose without a Docker daemon.

python tests/check_compose_integration.py /path/to/server/docker-compose.yml
Uses temporary dummy credentials and never prints the rendered configuration.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path


def main():
    base = Path(sys.argv[1]).resolve()
    root = Path(__file__).resolve().parent.parent
    override = root / "deployment/docker-compose.medresearch.yml"
    with tempfile.TemporaryDirectory(prefix="medresearch-compose-check-") as directory:
        fixture = Path(directory) / "test.env"
        fixture.write_text(
            "OIDC_DISCOVERY_URL=https://provider.example/discovery\n"
            "OIDC_CLIENT_ID=compose-test-client\n"
            "OIDC_CLIENT_SECRET=compose-test-secret\n"
            "SESSION_SECRET=compose-test-session-secret-at-least-32-characters\n"
            "APP_BASE_URL=https://aics.femh.org.tw/medresearch\n"
            "OIDC_REDIRECT_URI=https://aics.femh.org.tw/medresearch/auth/callback\n",
            encoding="utf-8",
        )
        env = dict(os.environ, MEDRESEARCH_PROJECT_DIR=str(root), MEDRESEARCH_ENV_FILE=str(fixture))
        command = ["docker", "compose", "--env-file", str(fixture), "-p", "medresearch-config-check", "-f", str(base)]

        def render(files):
            result = subprocess.run(command + files + ["config", "--format", "json"], env=env, capture_output=True, text=True)
            if result.returncode:
                # Avoid leaking a rendered env file or original server configuration.
                raise RuntimeError("Compose config failed; inspect locally with config --quiet")
            return json.loads(result.stdout)

        original = render([])
        merged = render(["-f", str(override)])
        assert set(merged["services"]) == set(original["services"]) | {"medresearch-app"}
        for name, service in original["services"].items():
            assert merged["services"][name] == service, f"Existing service changed: {name}"
        assert merged["networks"] == original["networks"]
        assert merged.get("secrets") == original.get("secrets")
        service = merged["services"]["medresearch-app"]
        assert not service.get("ports"), "New service must not publish a Host Port"
        assert set(service["networks"]) == {"app_internal"}
        assert Path(service["build"]["context"]) == root
        assert service["command"][service["command"].index("--root-path") + 1] == "/medresearch"
        assert service["command"][service["command"].index("--workers") + 1] == "1"
        assert service["environment"]["APP_ENV"] == "production"
        assert service["environment"]["OIDC_DEBUG_CLAIMS"] == "false"
    print("PASS Compose merge: existing services, networks, secrets and ports preserved; new service has no Host Port")


if __name__ == "__main__":
    main()
