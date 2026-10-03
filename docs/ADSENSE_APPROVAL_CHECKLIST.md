# AdSense readiness and approval checklist

This is the tawazon repository contains code-side checks for Google AdSense readiness.

## Automated checks

- Publisher verification marker and publisher ID.
- AdSense loader/unit placement limited to editorial content routes.
- No AdSense placement on policy, utility, private, noindex, or 404 pages.
- ads.txt syntax and publisher authorization line when the file exists.
- Privacy-policy disclosure of Google advertising/data use and cookies.
- Duplicate titles/descriptions reported as warnings.
- Arabic primary-language metadata checked on content pages.
- Health-site custom audience/remarketing patterns rejected for Tawazon.
- Robots source and live robots validation separated.
- EU/UK/Switzerland consent configuration reported as a manual account/CMP requirement.

## Manual AdSense account tasks

1. Add the production domain in AdSense under Sites.
2. Verify ownership using the AdSense verification method shown in the account. The site HTML already exposes the publisher verification marker.
3. Request review only after the production site is live, navigable, and the policy/content checks are clean.
4. For personalized ads to users in the EEA, UK, or Switzerland, configure a Google-certified CMP integrated with IAB TCF or another Google-supported consent setup before personalized ads are served.
5. Review the AdSense Policy Center after approval and act on any site-level policy or regulatory messages.
6. Keep the privacy policy current with Google advertising, cookies/local storage, and data-use disclosures.
7. Never use health information or inferred health interests as custom audience/remarketing signals on Tawazon.

## Google references

- Eligibility: https://support.google.com/adsense/answer/9724
- Pages ready for AdSense: https://support.google.com/adsense/answer/7299563
- Site verification: https://support.google.com/adsense/answer/12169212
- Code placement: https://support.google.com/adsense/answer/9274516
- Privacy and disclosures: https://support.google.com/publisherpolicies/answer/10502938
- CMP requirements: https://support.google.com/adsense/answer/13554116
- Ads.txt: https://support.google.com/adsense/answer/12171612
- Program policies: https://support.google.com/adsense/answer/48182
