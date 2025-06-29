/*
  # Create Admin User

  This migration creates an admin user for the system.
  
  1. User Creation
    - Creates user: support@workplaceinterventions.com.au
    - Sets up proper authentication records
    - Handles existing user gracefully
  
  2. Security
    - Uses proper password hashing
    - Sets up identity records correctly
    - Includes all required fields
*/

-- Check if user already exists and insert if not
DO $$
DECLARE
    user_exists boolean;
    new_user_id uuid;
BEGIN
    -- Check if user already exists
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = 'support@workplaceinterventions.com.au') INTO user_exists;
    
    IF NOT user_exists THEN
        -- Generate new user ID
        new_user_id := gen_random_uuid();
        
        -- Insert admin user into auth.users table
        INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            created_at,
            updated_at,
            role,
            aud
        ) VALUES (
            new_user_id,
            '00000000-0000-0000-0000-000000000000',
            'support@workplaceinterventions.com.au',
            crypt('Thiago77!', gen_salt('bf')),
            now(),
            now(),
            now(),
            'authenticated',
            'authenticated'
        );

        -- Insert corresponding identity record with provider_id
        INSERT INTO auth.identities (
            id,
            user_id,
            identity_data,
            provider,
            provider_id,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            new_user_id,
            jsonb_build_object('sub', new_user_id::text, 'email', 'support@workplaceinterventions.com.au'),
            'email',
            'support@workplaceinterventions.com.au',
            now(),
            now()
        );
        
        RAISE NOTICE 'Admin user created successfully';
    ELSE
        RAISE NOTICE 'Admin user already exists, skipping creation';
    END IF;
END $$;