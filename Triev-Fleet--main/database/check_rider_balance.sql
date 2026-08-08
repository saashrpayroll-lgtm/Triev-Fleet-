-- CHECK SCRIPT: Verify Balance for Babul Singh
SELECT 
    id, 
    mobile_number, 
    wallet_amount, 
    updated_at 
FROM public.riders 
WHERE mobile_number = '919508604046';
