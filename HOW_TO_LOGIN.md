# How to Log Into Your Elite Funding Solutions CRM

## Quick Start Guide

### 🚀 Option 1: Create Your First Admin User (Recommended)

#### Step 1: Access Supabase Dashboard
1. Go to your Supabase project: https://supabase.com/dashboard
2. Select your project: `mdrrcrmowurbrwvdsgnq`
3. Go to **Authentication** → **Users**

#### Step 2: Create Admin User
1. Click **"Add user"** button
2. Choose **"Create new user"**
3. Fill in:
   - **Email:** your_admin@elitefundingsolution.com
   - **Password:** Choose a strong password (min 6 characters)
   - **Auto Confirm User:** ✅ Check this box (important!)
4. Click **"Create user"**

#### Step 3: Create User Profile (Run SQL)
1. Copy the **User ID** that was just created
2. Go to **SQL Editor** in Supabase
3. Run this SQL (replace the user_id and email):

```sql
-- Replace these values with your actual data
INSERT INTO user_profiles (
    user_id,
    organization_id,
    email,
    first_name,
    last_name,
    role,
    is_active
) VALUES (
    'paste-user-id-here',  -- Replace with the User ID from step 2
    '00000000-0000-0000-0000-000000000001',  -- Default org ID
    'your_admin@elitefundingsolution.com',  -- Your email
    'Admin',  -- First name
    'User',   -- Last name
    'super_admin',  -- Role
    true
);
```

#### Step 4: Log In!
1. Go to your CRM URL:
   - **Local:** http://localhost:3000/login
   - **Vercel:** https://your-app.vercel.app/login
2. Enter your email and password
3. Click **"Sign In"**
4. You'll be redirected to the CRM dashboard!

---

### 🎯 Option 2: Use SQL Script (Faster)

Run this complete SQL script in Supabase SQL Editor:

```sql
-- Create a test admin user with profile in one go
-- Change these values as needed
DO $$
DECLARE
    v_user_id UUID;
    v_email TEXT := 'admin@elitefundingsolution.com';  -- CHANGE THIS
    v_password TEXT := 'Admin123!';  -- CHANGE THIS
BEGIN
    -- Create auth user
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
    ) VALUES (
        gen_random_uuid(),
        '00000000-0000-0000-0000-000000000000',
        v_email,
        crypt(v_password, gen_salt('bf')),  -- Encrypt password
        NOW(),
        '{"provider":"email","providers":["email"]}',
        '{}',
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
    )
    RETURNING id INTO v_user_id;

    -- Create user profile
    INSERT INTO user_profiles (
        user_id,
        organization_id,
        email,
        first_name,
        last_name,
        role,
        is_active
    ) VALUES (
        v_user_id,
        '00000000-0000-0000-0000-000000000001',
        v_email,
        'Admin',
        'User',
        'super_admin',
        true
    );

    RAISE NOTICE 'User created successfully! Email: %, Password: %', v_email, v_password;
END $$;
```

**Then log in with:**
- Email: admin@elitefundingsolution.com
- Password: Admin123!

---

### 👥 Option 3: Invite Team Members (After You're Logged In)

Once you're logged in as admin:

1. Go to **Users** page in the CRM
2. Click **"Invite User"**
3. Fill in their details:
   - First Name
   - Last Name
   - Email
   - Role (Sales Rep, Underwriter, etc.)
4. Click **"Send Invitation"**

They'll receive login credentials and can access the CRM.

---

## 🔐 Login Page URLs

- **Development:** http://localhost:3000/login
- **Production:** https://your-vercel-app.vercel.app/login
- **Custom Domain:** https://crm.elitefundingsolution.com/login (if set up)

---

## 🎭 User Roles Available

When creating users, you can assign these roles:

| Role | Access Level | What They Can Do |
|------|-------------|------------------|
| **Super Admin** | Full Access | Everything |
| **Admin** | High | Manage users, settings, all deals |
| **Manager** | Medium-High | View all, manage team deals |
| **Sales Rep** | Medium | Create leads, applications, deals |
| **Underwriter** | Medium | Review applications, approve/decline |
| **Processor** | Medium | Process documents, contracts |
| **ISO/Broker** | Limited | Submit deals, view commissions |
| **Client** | Portal Only | View own applications, upload docs |
| **Viewer** | Read-Only | View-only access to CRM |

---

## 🚨 Troubleshooting

### "Invalid login credentials" Error
- ✅ Check email is spelled correctly
- ✅ Make sure user is created in Supabase Auth
- ✅ Verify user profile exists in user_profiles table
- ✅ Check "Auto Confirm User" was enabled
- ✅ Try password reset if needed

### "User has no profile" Error
- ✅ Run the profile creation SQL (Step 3 above)
- ✅ Make sure organization_id matches

### Can't Access Supabase Dashboard
- ✅ Use the credentials you set up initially
- ✅ Project Reference: `mdrrcrmowurbrwvdsgnq`
- ✅ URL: https://supabase.com/dashboard

### Forgot Your Password
1. Go to login page
2. Click "Forgot password?"
3. Enter your email
4. Check email for reset link
5. Create new password

---

## 📧 Test Credentials (For Development)

For quick testing, you can create a test account:

**Email:** test@elitefundingsolution.com  
**Password:** Test123!  
**Role:** super_admin  

Use the SQL script in Option 2 above with these credentials.

---

## 🎉 After Logging In

Once logged in, you'll see:

1. **Dashboard** - Overview of all metrics
2. **Sidebar Menu** - Access to all modules:
   - Leads
   - Applications
   - Pipeline
   - Underwriting
   - Offers
   - Contracts
   - Documents
   - Tasks
   - Renewals
   - Commissions
   - ISO/Brokers
   - Reports
   - Settings

3. **User Menu** - Top right corner:
   - Profile settings
   - Gmail connection
   - Logout

---

## 🔄 Quick Test Flow

1. **Log in** with your admin account
2. **Create a lead** (Leads page → New Lead)
3. **View dashboard** to see it appear in metrics
4. **Create a deal** (Pipeline page → New Deal)
5. **Upload a document** (Documents page → Upload)
6. **Check reports** (Reports page)
7. **Connect Gmail** (Settings page)

---

## 💡 Pro Tips

✅ **Change Default Password** - After first login, change to a secure password  
✅ **Set Up 2FA** - Enable two-factor authentication in settings  
✅ **Create Team Users** - Invite your team members right away  
✅ **Connect Gmail** - Go to Settings → Connect Google Workspace  
✅ **Add Resend Key** - For automated email notifications  
✅ **Import Data** - Use bulk import for existing clients  

---

## 📞 Need Help?

If you're still having trouble logging in:

1. Check Supabase logs for errors
2. Verify environment variables are set
3. Make sure database migrations ran successfully
4. Check browser console for any errors
5. Try a different browser or incognito mode

---

**Ready to log in? Follow Option 1 or 2 above to create your admin account!** 🚀
