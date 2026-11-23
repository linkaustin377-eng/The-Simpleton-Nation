const DISCORD_API = "https://discord.com/api/v10";

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

function parseNativePoll(message) {
  if (!message || !message.poll) return null;
  const poll = message.poll;
  const questionText =
    (poll.question && (poll.question.text || poll.question)) || "Nation Poll";

  const answers = Array.isArray(poll.answers)
    ? poll.answers.map((ans, idx) => ({
        id: ans.answer_id !== undefined ? String(ans.answer_id) : String(idx + 1),
        label:
          (ans.poll_media && ans.poll_media.text) ||
          (ans.text) ||
          `Option ${idx + 1}`
      }))
    : [];

  let isExpired = false;
  if (poll.expiry) {
    const expMs = Date.parse(poll.expiry);
    if (!Number.isNaN(expMs) && Date.now() > expMs) {
      isExpired = true;
    }
  }

  return {
    id: message.id,
    question: questionText,
    allowMultiselect: Boolean(poll.allow_multiselect),
    expiry: poll.expiry || null,
    isExpired,
    answers
  };
}

export async function onRequestGet(context) {
  const { DISCORD_BOT_TOKEN, DISCORD_CHANNEL_ID } = context.env || {};
  if (!DISCORD_BOT_TOKEN || !DISCORD_CHANNEL_ID) {
    return jsonResponse(
      { ok: false, error: "Missing DISCORD_BOT_TOKEN or DISCORD_CHANNEL_ID in Cloudflare." },
      500
    );
  }

  try {
    const res = await fetch(
      `${DISCORD_API}/channels/${encodeURIComponent(DISCORD_CHANNEL_ID)}/messages?limit=25`,
      {
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`
        }
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      return jsonResponse(
        { ok: false, error: `Discord fetch failed (${res.status}): ${errText}` },
        502
      );
    }

    const messages = await res.json();
    const polls = [];
    for (const msg of messages) {
      const parsed = parseNativePoll(msg);
      if (parsed) {
        polls.push(parsed);
      }
    }

    return jsonResponse({ ok: true, polls });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message || "Failed to load polls." }, 500);
  }
}

export async function onRequestPost(context) {
  const { DISCORD_BOT_TOKEN, DISCORD_CHANNEL_ID } = context.env || {};
  if (!DISCORD_BOT_TOKEN || !DISCORD_CHANNEL_ID) {
    return jsonResponse(
      { ok: false, error: "Missing DISCORD_BOT_TOKEN or DISCORD_CHANNEL_ID in Cloudflare." },
      500
    );
  }

  let body;
  try {
    body = await context.request.json();
  } catch (_) {
    return jsonResponse({ ok: false, error: "Invalid request payload." }, 400);
  }

  const citizenName = String(body.citizenName || "").trim();
  const citizenUid = String(body.citizenUid || "").trim();
  const pollId = String(body.pollId || "").trim();
  const pollQuestion = String(body.pollQuestion || "").trim();
  const answerLabel = String(body.answerLabel || "").trim();

  if (!citizenName || !citizenUid || !pollId || !answerLabel) {
    return jsonResponse({ ok: false, error: "Missing required vote details." }, 400);
  }

  const receiptContent =
    `🗳️ **Official Vote Receipt**\n` +
    `**Citizen:** ${citizenName} (\`SN-${citizenUid.slice(0, 6).toUpperCase()}\`)\n` +
    `**Poll:** ${pollQuestion || `Poll #${pollId}`}\n` +
    `**Choice:** **${answerLabel}**`;

  try {
    const res = await fetch(
      `${DISCORD_API}/channels/${encodeURIComponent(DISCORD_CHANNEL_ID)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          content: receiptContent,
          allowed_mentions: { parse: [] }
        })
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      return jsonResponse(
        { ok: false, error: `Discord vote post failed (${res.status}): ${errText}` },
        502
      );
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message || "Failed to submit vote." }, 500);
  }
}
