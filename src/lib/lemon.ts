// Lemon Squeezy client-side helper to construct a checkout URL
// Requires VITE_LS_CHECKOUT_URL set to your Lemon Squeezy buy link, e.g.
// https://store.lemonade.dev/buy/abcdefg

export function getLemonCheckoutUrl(opts: {
  projectId: string;
  projectTitle?: string;
}): string {
  const base = import.meta.env.VITE_LS_CHECKOUT_URL as string | undefined;
  if (!base) {
    throw new Error('VITE_LS_CHECKOUT_URL is not set');
  }
  const origin = window.location.origin;
  const success = new URL('/payment/return', origin);
  success.searchParams.set('status', 'success');
  success.searchParams.set('projectId', opts.projectId);

  const cancel = new URL('/payment/return', origin);
  cancel.searchParams.set('status', 'cancel');
  cancel.searchParams.set('projectId', opts.projectId);

  const url = new URL(base);
  // Lemon Squeezy supports these params on Buy Links
  url.searchParams.set('checkout[success_url]', success.toString());
  url.searchParams.set('checkout[cancel_url]', cancel.toString());
  // Optional: attach metadata so you can match in webhook
  url.searchParams.set('checkout[custom][projectId]', opts.projectId);
  if (opts.projectTitle) url.searchParams.set('checkout[custom][projectTitle]', opts.projectTitle);

  return url.toString();
}

export function openLemonCheckout(projectId: string, projectTitle?: string) {
  const href = getLemonCheckoutUrl({ projectId, projectTitle });
  window.location.href = href; // redirect current tab
}
