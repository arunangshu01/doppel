import json
import re
import subprocess
from pathlib import Path

import yaml

from model.schema import SchemaInput

ROOT = Path(__file__).resolve().parents[2]


def load_yaml(path):
    return yaml.load((ROOT / path).read_text(), Loader=yaml.BaseLoader)


def test_ci_gate_and_keyless_deployment():
    workflow = load_yaml(".github/workflows/deploy.yml")
    assert set(workflow["on"]) == {"workflow_run"}
    assert workflow["on"]["workflow_run"] == {"workflows": ["CI"], "types": ["completed"], "branches": ["main"]}
    assert workflow["env"]["COMMIT"] == "${{ github.event.workflow_run.head_sha }}"
    job = workflow["jobs"]["deploy"]
    for guard in ["conclusion == 'success'", "event == 'push'", "head_branch == 'main'", "head_repository.full_name == github.repository"]:
        assert guard in job["if"]
    assert job["environment"] == "production"
    assert job["permissions"] == {"contents": "read", "id-token": "write"}
    steps = job["steps"]
    checkout = next(step for step in steps if step.get("uses", "").startswith("actions/checkout@"))
    assert checkout["with"] == {"ref": "${{ env.COMMIT }}", "persist-credentials": "false"}
    auth = next(step for step in steps if step.get("uses", "").startswith("google-github-actions/auth@"))
    assert set(auth["with"]) == {"workload_identity_provider", "service_account"}
    assert all("${{ vars." in value for value in auth["with"].values())
    scripts = "\n".join(step.get("run", "") for step in steps)
    for expected in ["--port 8080", "--min-instances 0", "--max-instances 1", "--region", "doppel-admin-token:latest", "VITE_API_URL"]:
        assert expected in scripts or expected in str(steps)
    assert scripts.count('test "$COMMIT" = "$HEAD_SHA"') == 2
    assert "ap-portfolio-241026|mahakal-ai-230925" in scripts
    for step in steps:
        if "run" in step:
            subprocess.run(["bash", "-n"], input=step["run"], text=True, check=True, capture_output=True)


def test_hosting_rewrite_and_nonsecret_environment():
    hosting = json.loads((ROOT / "firebase.json").read_text())["hosting"]
    assert hosting["public"] == "frontend/dist"
    assert hosting["rewrites"][0] == {"source": "/doppel/api/**", "run": {"serviceId": "doppel-api", "region": "asia-south1"}}
    assert hosting["rewrites"][-1] == {"source": "**", "destination": "/index.html"}
    assert hosting["site"] == "REPLACE_WITH_DOPPEL_SITE_ID" or re.fullmatch(r"[a-z0-9][a-z0-9-]+", hosting["site"])
    env = load_yaml("deploy/cloud-run.env.yaml")
    assert "ADMIN_TOKEN" not in env
    docker = (ROOT / "backend/Dockerfile").read_text()
    assert "FROM python:3.12-slim" in docker
    assert "USER appuser" in docker
    assert "PORT=8080" in docker and "--workers 1" in docker
    assert "COPY . ." not in docker


def test_readme_schema_and_command_syntax():
    readme = (ROOT / "README.md").read_text()
    example = re.search(r"```json\n(.*?)\n```", readme, re.S).group(1)
    assert SchemaInput.model_validate(json.loads(example)).resources["orders"].fields["user_id"].target == "users.id"
    for command in re.findall(r"```bash\n(.*?)\n```", readme, re.S):
        subprocess.run(["bash", "-n"], input=command, text=True, check=True, capture_output=True)
    assert "—" not in readme and "–" not in readme
