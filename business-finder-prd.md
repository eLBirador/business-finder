
## 12. Info card (embed)
Tagline, hours, phone (`tel:`) and website (http/https only, shown as host+path, 40 chars max) appear under the name and street. Values come from D1 `display` for `/e/<id>`, or from query params for `/embed`. They are cleaned server-side and rendered with textContent. Under 360x300 the card collapses to name and street, with an "i" toggle (aria-expanded). The colour is indigo #4f46e5.

## 13. Edit-link email
On create and on "resend my edit link", the edit link is emailed from info@yahaay.com. Pages Functions cannot bind send_email, so the yahaay.com Worker relays the email (`/internal/bf-mail`, shared secret `BF_MAIL_SECRET`). The token sits in the URL fragment (`/business-finder/edit#id=&token=`). The edit view loads the record, prefills the form, and sends a PUT with the Bearer token. The edit key is still shown once as a fallback. Resend issues a new token and does not reveal whether an email exists.

## 14. Spam protection
Turnstile on the submit and resend steps, with server-side siteverify and a hostname allowlist. Also a honeypot `company_site`, at least 3 s from form display to submit, a per-IP limit in memory, and a durable D1 limit (`rate_limit`, hourly buckets, IPs stored as SHA-256 hashes, rows pruned after 24 h). Without a secret the API returns 503 (it fails closed).
