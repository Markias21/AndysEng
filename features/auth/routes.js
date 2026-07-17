import { Router } from "express";
import crypto from "node:crypto";
import { buildAuthUrl, exchangeCode, isConfigured } from "../../shared/google-auth.js";
import { upsertUser, getUser } from "../../shared/store.js";
import { createSession, currentUser, logout, parseCookies } from "../../shared/session.js";

// 구글 OAuth 로그인/가입. 키가 없으면 google-auth.js가 503으로 알린다.
const router = Router();
const STATE_COOKIE = "andyseng_oauth_state";

router.get("/google", (req, res, next) => {
  try {
    const state = crypto.randomBytes(16).toString("hex");
    res.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 10 * 60 * 1000,
      path: "/",
    });
    res.redirect(buildAuthUrl(state));
  } catch (err) {
    next(err);
  }
});

router.get("/google/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    const cookieState = parseCookies(req)[STATE_COOKIE];
    if (!code || !state || state !== cookieState) {
      return res.redirect("/?login=error");
    }
    res.clearCookie(STATE_COOKIE, { path: "/" });

    const { tokens, profile } = await exchangeCode(code);
    upsertUser(profile, tokens.refresh_token);
    createSession(res, profile.sub);
    res.redirect("/");
  } catch (err) {
    // 로그인 실패는 삼키지 않고 로그로 남기되, 사용자는 로그인 화면으로 돌려보낸다.
    console.error(err);
    res.redirect("/?login=error");
  }
});

router.post("/logout", (req, res) => {
  logout(req, res);
  res.json({ ok: true });
});

router.get("/me", (req, res) => {
  if (!isConfigured()) return res.json({ configured: false, user: null });
  const user = currentUser(req);
  if (!user) return res.json({ configured: true, user: null });
  const full = getUser(user.id);
  res.json({
    configured: true,
    user: { name: user.name, email: user.email, picture: user.picture },
    settings: full.settings,
  });
});

export default router;
