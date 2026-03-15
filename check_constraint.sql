SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.users'::regclass;  
