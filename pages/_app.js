import '@/styles/globals.css';

/**
 * The custom App component. In Next.js, this wraps every page and can be used
 * to apply global styles or layout components. We simply import the global
 * stylesheet to ensure our CSS is applied across all pages.
 *
 * See https://nextjs.org/docs/pages/building-your-application/routing/custom-app for details.
 */
export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}