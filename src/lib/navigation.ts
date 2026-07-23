export function safeBack(router: { canGoBack: () => boolean; back: () => void; replace: (href: any) => void }) {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace("/");
}

