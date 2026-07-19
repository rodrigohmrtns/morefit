"""Tests for VitaTracker Modules 16-20: Gamification, Community, Professional PDF sharing."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://fitpro-ecosystem-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

TEST_EMAIL = "ana@example.com"
TEST_PASSWORD = "secret123"


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth(api_client):
    # Try login first
    r = api_client.post(f"{API}/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    if r.status_code != 200:
        # Register if not present
        r2 = api_client.post(f"{API}/auth/register", json={"name": "Ana Silva", "email": TEST_EMAIL, "password": TEST_PASSWORD})
        assert r2.status_code == 200, f"register failed: {r2.status_code} {r2.text}"
        data = r2.json()
    else:
        data = r.json()
    return {"token": data["token"], "user": data["user"], "headers": {"Authorization": f"Bearer {data['token']}"}}


# ---------- Module 16: Gamification ----------
class TestGamification:
    def test_gamification_shape(self, api_client, auth):
        r = api_client.get(f"{API}/gamification", headers=auth["headers"])
        assert r.status_code == 200, r.text
        j = r.json()
        for k in ("xp", "level", "next_level_xp", "level_progress_pct", "streak", "achievements", "stats", "challenges"):
            assert k in j, f"missing key {k}"
        assert isinstance(j["achievements"], list)
        assert len(j["achievements"]) == 12, f"expected 12 achievements, got {len(j['achievements'])}"
        for a in j["achievements"]:
            for kk in ("id", "name", "desc", "icon", "xp", "unlocked"):
                assert kk in a, f"missing achievement field {kk}"
        assert isinstance(j["challenges"], list)
        assert len(j["challenges"]) == 3

    def test_leaderboard(self, api_client, auth):
        r = api_client.get(f"{API}/gamification/leaderboard?limit=20", headers=auth["headers"])
        assert r.status_code == 200, r.text
        j = r.json()
        for k in ("items", "my_rank", "total_users"):
            assert k in j
        items = j["items"]
        assert len(items) > 0
        # ranks start at 1 and are sequential in returned list
        for i, e in enumerate(items):
            for kk in ("user_id", "name", "avatar", "xp", "level", "streak", "is_me", "rank"):
                assert kk in e
            assert e["rank"] == i + 1
        # sorted desc by xp
        xps = [e["xp"] for e in items]
        assert xps == sorted(xps, reverse=True)
        # is_me true for exactly one entry
        me = [e for e in items if e["is_me"]]
        # my_rank must equal rank of is_me item (if my entry is within limit)
        if me:
            assert me[0]["rank"] == j["my_rank"]
        assert j["total_users"] >= 1


# ---------- Module 17: Community ----------
class TestCommunity:
    post_id = None

    def test_create_post(self, api_client, auth):
        r = api_client.post(f"{API}/community/posts", headers=auth["headers"],
                            json={"text": "Teste automatizado 🚀", "kind": "update"})
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["id"].startswith("post_")
        assert p["likes"] == []
        assert p["comments_count"] == 0
        assert p["kind"] == "update"
        assert p["text"] == "Teste automatizado 🚀"
        TestCommunity.post_id = p["id"]

    def test_list_contains(self, api_client, auth):
        r = api_client.get(f"{API}/community/posts?limit=50", headers=auth["headers"])
        assert r.status_code == 200
        ids = [p["id"] for p in r.json()["items"]]
        assert TestCommunity.post_id in ids

    def test_filter_kind_recipe_excludes_update(self, api_client, auth):
        r = api_client.get(f"{API}/community/posts?kind=recipe", headers=auth["headers"])
        assert r.status_code == 200
        ids = [p["id"] for p in r.json()["items"]]
        assert TestCommunity.post_id not in ids

    def test_like_toggle(self, api_client, auth):
        pid = TestCommunity.post_id
        r1 = api_client.post(f"{API}/community/posts/{pid}/like", headers=auth["headers"])
        assert r1.status_code == 200
        j1 = r1.json()
        assert j1["liked"] is True
        assert j1["count"] == 1
        r2 = api_client.post(f"{API}/community/posts/{pid}/like", headers=auth["headers"])
        j2 = r2.json()
        assert j2["liked"] is False
        assert j2["count"] == 0

    def test_add_comment(self, api_client, auth):
        pid = TestCommunity.post_id
        r = api_client.post(f"{API}/community/posts/{pid}/comments", headers=auth["headers"],
                            json={"text": "Ótimo!"})
        assert r.status_code == 200, r.text
        c = r.json()
        assert c["text"] == "Ótimo!"
        assert c["post_id"] == pid

        # GET comments
        rc = api_client.get(f"{API}/community/posts/{pid}/comments", headers=auth["headers"])
        assert rc.status_code == 200
        texts = [x["text"] for x in rc.json()["items"]]
        assert "Ótimo!" in texts

        # comments_count updated
        rl = api_client.get(f"{API}/community/posts?limit=50", headers=auth["headers"])
        posts = {p["id"]: p for p in rl.json()["items"]}
        assert posts[pid]["comments_count"] >= 1

    def test_delete_post(self, api_client, auth):
        pid = TestCommunity.post_id
        r = api_client.delete(f"{API}/community/posts/{pid}", headers=auth["headers"])
        assert r.status_code == 200
        assert r.json() == {"ok": True}
        rl = api_client.get(f"{API}/community/posts?limit=50", headers=auth["headers"])
        ids = [p["id"] for p in rl.json()["items"]]
        assert pid not in ids


# ---------- Modules 18-20: Professionals + PDF ----------
class TestProfessionalShare:
    share_id = None
    share_token = None

    def test_create_share(self, api_client, auth):
        r = api_client.post(f"{API}/professionals/share", headers=auth["headers"],
                            json={"professional_type": "nutritionist", "professional_name": "Dra. Marina"})
        assert r.status_code == 200, r.text
        j = r.json()
        for k in ("id", "token", "share_url", "professional_type", "expires_at"):
            assert k in j
        assert j["professional_type"] == "nutritionist"
        assert j["share_url"].startswith("/report/")
        TestProfessionalShare.share_id = j["id"]
        TestProfessionalShare.share_token = j["token"]

    def test_list_shares(self, api_client, auth):
        r = api_client.get(f"{API}/professionals/shares", headers=auth["headers"])
        assert r.status_code == 200
        ids = [s["id"] for s in r.json()["items"]]
        assert TestProfessionalShare.share_id in ids

    def test_public_report_html_nutritionist(self, api_client, auth):
        tok = TestProfessionalShare.share_token
        r = requests.get(f"{BASE_URL}/report/{tok}")
        assert r.status_code == 200
        html = r.text.lower()
        assert html.startswith("<!doctype html>")
        assert "nutricionista" in html
        # nutritionist should NOT include sleep; personal excludes 'Refeições recentes'; doctor includes 'Sono'
        # For nutritionist, meals should be visible ('Refeições recentes'), sleep not visible
        assert "sono" not in html  # <h2>Sono</h2> not for nutritionist

    def test_public_report_personal_no_meals(self, api_client, auth):
        r = api_client.post(f"{API}/professionals/share", headers=auth["headers"],
                            json={"professional_type": "personal"})
        assert r.status_code == 200
        tok = r.json()["token"]
        rr = requests.get(f"{BASE_URL}/report/{tok}")
        assert rr.status_code == 200
        html = rr.text
        assert "Refeições recentes" not in html
        # cleanup
        api_client.delete(f"{API}/professionals/shares/{r.json()['id']}", headers=auth["headers"])

    def test_public_report_doctor_has_sleep(self, api_client, auth):
        r = api_client.post(f"{API}/professionals/share", headers=auth["headers"],
                            json={"professional_type": "doctor"})
        assert r.status_code == 200
        tok = r.json()["token"]
        rr = requests.get(f"{BASE_URL}/report/{tok}")
        assert rr.status_code == 200
        assert "Sono" in rr.text
        api_client.delete(f"{API}/professionals/shares/{r.json()['id']}", headers=auth["headers"])

    def test_report_pdf_all(self, api_client, auth):
        r = api_client.get(f"{API}/report/pdf", headers=auth["headers"])
        assert r.status_code == 200, r.text[:300]
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:4] == b"%PDF"

    def test_report_pdf_nutritionist_filename(self, api_client, auth):
        r = api_client.get(f"{API}/report/pdf?type=nutritionist", headers=auth["headers"])
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"
        disp = r.headers.get("content-disposition", "")
        assert "nutritionist" in disp.lower()

    def test_delete_share(self, api_client, auth):
        r = api_client.delete(f"{API}/professionals/shares/{TestProfessionalShare.share_id}", headers=auth["headers"])
        assert r.status_code == 200
        assert r.json() == {"ok": True}
