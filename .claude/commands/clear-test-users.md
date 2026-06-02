Clear all user data from the Supabase database for testing purposes. Do NOT delete anything from `north_american_plant_foods`.

Run this SQL via the Supabase MCP tool in this exact order (to respect foreign key constraints):

```sql
DELETE FROM public.food_skip_tracking;
DELETE FROM public.food_rotation_history;
DELETE FROM public.user_active_plants;
DELETE FROM public.user_allergies;
DELETE FROM public.profiles;
DELETE FROM auth.users;
```

After running, confirm to the user that all users and their data have been cleared and that `north_american_plant_foods` was left untouched.
