function messageFromError(error, fallback = '処理に失敗しました。もう一度試してください。') {
  if (error?.issues?.[0]?.message) {
    return error.issues[0].message;
  }
  if (typeof error?.message === 'string' && error.message) {
    return error.message;
  }
  return fallback;
}

module.exports = {
  messageFromError
};
