import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { Users, Star, Briefcase, Check, X } from 'lucide-react';
import { toast } from 'sonner';

const Teams = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [teams, setTeams] = useState<Array<Database['public']['Tables']['teams']['Row'] & { member_count: number }>>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [invites, setInvites] = useState<Array<{ id: string; team_id: string; created_at: string }>>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        // Fetch teams (public listing – assuming RLS allows select for all teams)
        const { data: teamsData, error } = await supabase
          .from('teams')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;

        // Fetch member counts per team
        const counts: Record<string, number> = {};
        if (teamsData && teamsData.length > 0) {
          const teamIds = teamsData.map(t => t.id);
          // Batch query team_members and count in-memory
          const { data: members, error: memErr } = await supabase
            .from('team_members')
            .select('team_id');
          if (memErr) throw memErr;
          members?.forEach(m => {
            const id = (m as any).team_id as string | null;
            if (!id) return;
            counts[id] = (counts[id] || 0) + 1;
          });
        }

        const withCounts = (teamsData || []).map(t => ({ ...t, member_count: counts[t.id] || 0 }));
        setTeams(withCounts);

        // Check if current user owns a team
        if (user) {
          const { data: mine, error: myErr } = await supabase
            .from('teams')
            .select('id')
            .eq('owner_id', user.id)
            .maybeSingle();
          if (myErr && myErr.code !== 'PGRST116') throw myErr; // ignore no rows
          setMyTeamId(mine?.id || null);

          // Load my pending invites
          try {
            setInvitesLoading(true);
            const { data: inv, error: invErr } = await supabase
              .from('team_invites')
              .select('id, team_id, created_at')
              .eq('to_user_id', user.id)
              .eq('status', 'pending')
              .order('created_at', { ascending: false });
            if (invErr) throw invErr;
            setInvites(inv || []);
          } catch (e) {
            console.error(e);
          } finally {
            setInvitesLoading(false);
          }
        } else {
          setMyTeamId(null);
          setInvites([]);
        }
      } catch (e: any) {
        console.error(e);
        toast.error('Failed to load teams');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const myTeam = useMemo(() => (user && myTeamId ? teams.find(t => t.id === myTeamId) : undefined), [user, myTeamId, teams]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return teams.filter(team => {
      const matchesQ = !q || team.name.toLowerCase().includes(q) || (team.description || '').toLowerCase().includes(q);
      return matchesQ;
    });
  }, [teams, query]);

  const acceptInvite = async (inviteId: string, teamId: string) => {
    if (!user) return;
    try {
      const { error: upErr } = await supabase
        .from('team_invites')
        .update({ status: 'accepted' })
        .eq('id', inviteId);
      if (upErr) throw upErr;
      const { error: memErr } = await supabase
        .from('team_members')
        .insert({ team_id: teamId, user_id: user.id, role: 'Member' });
      if (memErr) throw memErr;
      setInvites(prev => prev.filter(i => i.id !== inviteId));
      toast.success('Joined team');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to accept invite');
    }
  };

  const declineInvite = async (inviteId: string) => {
    try {
      const { error } = await supabase
        .from('team_invites')
        .update({ status: 'declined' })
        .eq('id', inviteId);
      if (error) throw error;
      setInvites(prev => prev.filter(i => i.id !== inviteId));
      toast.success('Invite declined');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to decline invite');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6 space-y-4">
                  <div className="h-10 bg-muted rounded" />
                  <div className="h-4 bg-muted rounded w-2/3" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Teams</h1>
          {user && !myTeam && (
            <Button onClick={() => navigate('/teams/create')}>Create a Team</Button>
          )}
        </div>

        {/* Invites Section */}
        {user && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Your Invites</h2>
            {invitesLoading && <div className="text-sm text-muted-foreground">Loading invites…</div>}
            {!invitesLoading && invites.length === 0 && (
              <div className="text-sm text-muted-foreground">No pending invites</div>
            )}
            {!invitesLoading && invites.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {invites.map((inv) => (
                  <Card key={inv.id}>
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="text-sm">
                        <div className="font-medium">Team invite</div>
                        <div className="text-muted-foreground">Team ID: {inv.team_id.slice(0,8)}…</div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => declineInvite(inv.id)}>
                          <X className="w-4 h-4 mr-1" /> Decline
                        </Button>
                        <Button size="sm" onClick={() => acceptInvite(inv.id, inv.team_id)}>
                          <Check className="w-4 h-4 mr-1" /> Accept
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input placeholder="Search teams" value={query} onChange={e => setQuery(e.target.value)} />
          <div className="flex items-center justify-end text-sm text-muted-foreground md:col-span-2">
            {filtered.length} results
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filtered.map(team => (
            <Card key={team.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={team.logo_url || undefined} />
                    <AvatarFallback>{team.name.slice(0,2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{team.name}</p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Users className="w-4 h-4" />{team.member_count}</span>
                      <span className="inline-flex items-center gap-1"><Briefcase className="w-4 h-4" />0</span>
                      <span className="inline-flex items-center gap-1"><Star className="w-4 h-4" />0</span>
                    </div>
                  </div>
                </div>
                {team.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{team.description}</p>
                )}
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => navigate(`/team/${team.id}`)}>View Team</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Teams;
