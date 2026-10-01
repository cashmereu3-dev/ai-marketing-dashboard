// Google tag (gtag.js). Renders only when NEXT_PUBLIC_GA_MEASUREMENT_ID is set (a public ID like G-XXXXXXXXXX or GT-/AW-),
// so it can be verified with Google Tag Assistant. Never put secrets here.
import Script from "next/script";

const ID = (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "").trim();

export default function GoogleTag() {
  if (!/^(G|GT|AW|GTM)-[A-Z0-9]{4,20}$/i.test(ID)) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${ID}`} strategy="afterInteractive" />
      <Script id="google-tag" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${ID}', { anonymize_ip: true });
      `}</Script>
    </>
  );
}
