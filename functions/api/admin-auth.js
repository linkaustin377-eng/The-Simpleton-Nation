export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const pin = String(body && body.pin ? body.pin : "").trim();
    const expectedPin = String(context.env.ADMIN_PIN || "").trim();

    if (!expectedPin) {
      return new Response(
        JSON.stringify({ ok: false, error: "ADMIN_PIN is not set in Cloudflare Pages environment variables." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!pin || pin !== expectedPin) {
      return new Response(
        JSON.stringify({ ok: false, error: "Incorrect Admin PIN." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: "Invalid request." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}
