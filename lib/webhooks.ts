/** 완료 등 이벤트를 호출 앱(FM OS·MomoCare)에 POST. 실패해도 흐름을 막지 않음. */
export async function deliverWebhook(url: string, payload: Record<string, unknown>) {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-SignSign-Event": String(payload.event ?? "") },
      body: JSON.stringify(payload),
      // 호출 앱이 느려도 우리 흐름을 오래 잡지 않도록
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    console.error("[webhook] 발송 실패:", url, e);
  }
}
