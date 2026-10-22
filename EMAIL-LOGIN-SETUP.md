# Email login — one-time setup

Approved email: hamzabutt1557@gmail.com
App: https://elementor-studio.vercel.app/

App code ready hai. Email bhejne aur verify karne ke liye aapke apne Supabase project ka connection chahiye. Abhi password login active hai; verification email abhi send nahi hui.

1. https://supabase.com/dashboard par isi email se login karein aur **New project** banayein. Project ka database password apne paas save karein; app ko yeh password nahi chahiye.
2. Project ke **Connect / API settings** se **Project URL** aur **Publishable key** copy karein. Legacy `anon` key bhi supported hai. `service_role`, secret API key aur database password share na karein.
3. **Authentication → Sign In / Providers → Email** enable rakhein. **Confirm email** ON rakhein. Anonymous login OFF rakhein.
4. **Authentication → Email templates** mein **Confirm signup** aur **Magic Link** dono ka body yeh rakhein:

```html
<h2>Elementor Studio verification code</h2>
<p>Apne private workspace mein login karne ke liye yeh code enter karein:</p>
<p style="font-size:28px;font-weight:bold">{{ .Token }}</p>
<p>Agar aapne login request nahi ki, is email ko ignore karein.</p>
```

5. Email OTP expiry 10 minutes rakhein. **URL configuration → Site URL** mein `https://elementor-studio.vercel.app` rakhein. OTP form use ho raha hai, is liye email link redirect ki zaroorat nahi.
6. Vercel project ki Production environment variables mein yeh connection set hoga:

| Variable | Value |
|---|---|
| OWNER_EMAIL | hamzabutt1557@gmail.com |
| SUPABASE_URL | Aapka Project URL |
| SUPABASE_PUBLISHABLE_KEY | Project ki publishable / anon key |
| AUTH_MODE | email |

7. Redeploy ke baad app kholein → email enter karein → **Send verification code** → inbox se code copy karke **Verify & open workspace**.
8. Incognito mein doosri email se access reject check karein. Sign out ke baad private APIs 401 deni chahiye. Client Share preview ko alag check karein.

Supabase ka default email sender sirf project team ke email addresses ko send karta hai aur uski limit kam hai. Apna Supabase account approved email se banayein; agar us email ko sender permission nahi milti, project-team setting ya custom SMTP connect karein. Regular/multiple-user production email delivery ke liye custom SMTP chahiye. Is personal setup mein naya app domain khareedna zaroori nahi.

Agar connection incomplete ho to `AUTH_MODE=basic` rehne dein. `AUTH_MODE=email` ke baad missing connection par app 503 degi; purana password email check ko bypass nahi karega.

References:
- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://supabase.com/docs/guides/auth/server-side/creating-a-client
- https://supabase.com/docs/guides/auth/auth-smtp
