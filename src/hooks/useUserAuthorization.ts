import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useUserAuthorization = () => {
  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-authorization'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      
      const { data } = await supabase
        .from('profiles')
        .select('email, is_invited_user')
        .eq('id', session.user.id)
        .single();
      
      return data;
    }
  });

  const isBerkeleyUser = profile?.email?.endsWith('@berkeley.edu') ?? false;
  const isExternalUser = !isBerkeleyUser && !!profile;
  
  return { 
    isBerkeleyUser, 
    isExternalUser, 
    isLoading,
    userType: isBerkeleyUser ? 'berkeley' as const : 'external' as const
  };
};
