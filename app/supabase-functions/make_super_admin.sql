SELECT add_user_role(
    (SELECT id FROM auth.users WHERE email = 'numan@yopmail.com'),
    'superAdmin'::TEXT
);