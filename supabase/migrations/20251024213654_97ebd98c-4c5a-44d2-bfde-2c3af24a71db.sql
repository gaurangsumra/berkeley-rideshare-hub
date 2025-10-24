-- Update the handle_new_user function to handle invited users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id, 
    name, 
    photo, 
    program, 
    email,
    is_invited_user,
    invited_via_ride_id
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', new.email),
    new.raw_user_meta_data->>'avatar_url',
    COALESCE(new.raw_user_meta_data->>'program', 'Not specified'),
    new.email,
    COALESCE((new.raw_user_meta_data->>'is_invited_user')::boolean, false),
    (new.raw_user_meta_data->>'invited_via_ride_id')::uuid
  );
  RETURN new;
END;
$function$;