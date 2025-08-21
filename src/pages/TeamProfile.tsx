import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { MessageCircle, Users, Calendar, UserPlus, Trash2, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

const TeamProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [team, setTeam] = useState<Database['public']['Tables']['teams']['Row'] | null>(null);
  const [members, setMembers] = useState<Array<{ user_id: string; role: string; full_name: string | null; avatar_url: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Array<{ id: string; full_name: string; username?: string | null; avatar_url?: string | null }>>([]);
  const [selectedInvitee, setSelectedInvitee] = useState<{ id: string; full_name: string; username?: string | null; avatar_url?: string | null } | null>(null);

  useEffect(() => {
    if (id) {
      fetchTeam();
    }
  }, [id]);

  const fetchTeam = async () => {
    try {
      setLoading(true);
      const { data: t, error } = await supabase
        .from('teams')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      setTeam(t);

      // Load members with profile info
      const { data: mems, error: memErr } = await supabase
        .from('team_members')
        .select('user_id, role, profiles(full_name, avatar_url)')
        .eq('team_id', id);
      if (memErr) throw memErr;
      const mapped = (mems || []).map((m: any) => ({
        user_id: m.user_id as string,
        role: m.role as string,
        full_name: m.profiles?.full_name ?? null,
        avatar_url: m.profiles?.avatar_url ?? null,
      }));
      setMembers(mapped);
    } catch (e) {
      console.error(e);
      setTeam(null);
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = () => {
    if (!user || !id || !team) return;
    try {
      const existing = JSON.parse(localStorage.getItem('mock_conversations') || '[]');
      const found = existing.find((c: any) => c.other_user_id === team.id);
      if (found) {
        navigate(`/messages?conversation=${found.id}`);
        return;
      }
      const newConv = {
        id: `conv_${Date.now()}`,
        other_user_id: team.id,
        other_user_name: team.name,
        other_user_avatar: team.logo_url || `https://i.pravatar.cc/150?u=${team.id}`,
        last_message: 'Team conversation started',
        last_message_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      const updated = [newConv, ...existing];
      localStorage.setItem('mock_conversations', JSON.stringify(updated));
      navigate(`/messages?conversation=${newConv.id}`);
      toast.success('Team chatroom created');
    } catch (e) {
      console.error(e);
      toast.error('Failed to start chat');
    }
  };

  const isOwner = !!(user && team && team.owner_id === user.id);
  const isMember = !!(user && members.some(m => m.user_id === user.id));

  const handleInvite = () => {
    if (!user || !team) return;
    if (!selectedInvitee) return toast.error('Select a user to invite');
    const run = async () => {
      try {
        const { error } = await supabase
          .from('team_invites')
          .insert({ team_id: team.id, to_user_id: selectedInvitee.id, from_user_id: user.id, status: 'pending' });
        if (error) throw error;
        setSelectedInvitee(null);
        setSearchTerm('');
        setResults([]);
        toast.success('Invite sent');
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || 'Failed to send invite');
      }
    };
    run();
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setResults([]);
      return;
    }
    try {
      setSearching(true);
      const term = searchTerm.trim();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      let data: any[] | null = null;
      let error: any = null;
      if (uuidRegex.test(term)) {
        const res = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .eq('id', term)
          .limit(1);
        data = res.data as any[] | null;
        error = res.error;
      } else {
        const res = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .or(`username.ilike.%${term}%,full_name.ilike.%${term}%`)
          .limit(5);
        data = res.data as any[] | null;
        error = res.error;
      }
      if (error) throw error;
      setResults((data || []) as any);
    } catch (e) {
      console.error(e);
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleLeave = () => {
    if (!user || !team) return;
    const run = async () => {
      try {
        const { error } = await supabase
          .from('team_members')
          .delete()
          .eq('team_id', team.id)
          .eq('user_id', user.id);
        if (error) throw error;
        toast.message('You left the team');
        navigate('/teams');
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || 'Failed to leave');
      }
    };
    run();
  };

  const handleDissolve = () => {
    if (!team) return;
    if (!confirm('Are you sure you want to dissolve this team? This cannot be undone.')) return;
    const run = async () => {
      try {
        const { error } = await supabase
          .from('teams')
          .delete()
          .eq('id', team.id);
        if (error) throw error;
        toast.success('Team dissolved');
        navigate('/teams');
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || 'Failed to dissolve');
      }
    };
    run();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-32 bg-muted rounded-lg"></div>
            <div className="h-64 bg-muted rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-foreground-muted">Team not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Team Info */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <Avatar className="w-24 h-24 mx-auto">
                    <AvatarImage src={team.logo_url || undefined} />
                    <AvatarFallback>
                      {team.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div>
                    <h1 className="text-2xl font-bold">{team.name}</h1>
                    <p className="text-foreground-muted">Team</p>
                  </div>

                  <div className="flex items-center justify-center space-x-2 text-foreground-muted">
                    <Users className="w-4 h-4" />
                    <span>{members.length} members</span>
                  </div>

                  <div className="flex items-center justify-center space-x-2 text-foreground-muted">
                    <Calendar className="w-4 h-4" />
                    <span>Created {new Date(team.created_at).toLocaleDateString()}</span>
                  </div>

                  {user && !isOwner && (
                    <Button onClick={handleStartChat} className="w-full">
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Hire / Contact Team
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Team Owner */}
            <Card>
              <CardHeader>
                <CardTitle>Team Owner</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-3">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={undefined} />
                    <AvatarFallback>
                      {team.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">Owner ID: {team.owner_id}</p>
                    <p className="text-sm text-foreground-muted">Owner</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Owner Actions */}
            {isOwner && (
              <Card>
                <CardHeader>
                  <CardTitle>Manage Team</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex gap-2">
                      <Input placeholder="Search by @username or name" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }} />
                      <Button variant="outline" onClick={handleSearch} disabled={searching}>Search</Button>
                    </div>
                    {results.length > 0 && (
                      <div className="border rounded-md divide-y">
                        {results.map(r => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => setSelectedInvitee(r)}
                            className={`w-full text-left p-2 hover:bg-muted ${selectedInvitee?.id === r.id ? 'bg-muted' : ''}`}
                          >
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={r.avatar_url || undefined} />
                                <AvatarFallback>{(r.full_name || 'NA').slice(0,2).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">{r.full_name}</span>
                                <span className="text-xs text-muted-foreground">@{r.username || r.id}</span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {selectedInvitee && (
                      <div className="text-sm text-muted-foreground">Selected: {selectedInvitee.full_name} @{selectedInvitee.username || selectedInvitee.id}</div>
                    )}
                    <Button onClick={handleInvite} className="w-full" disabled={!selectedInvitee}>
                      <UserPlus className="w-4 h-4 mr-2" /> Send Invite
                    </Button>
                  </div>
                  <Button variant="destructive" onClick={handleDissolve} className="w-full">
                    <Trash2 className="w-4 h-4 mr-2" /> Dissolve Team
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Member Actions */}
            {isMember && !isOwner && (
              <Card>
                <CardHeader>
                  <CardTitle>Member</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" onClick={handleLeave} className="w-full">
                    <LogOut className="w-4 h-4 mr-2" /> Leave Team
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            {team.description && (
              <Card>
                <CardHeader>
                  <CardTitle>About</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground-muted leading-relaxed">{team.description}</p>
                </CardContent>
              </Card>
            )}

            {/* Team Members */}
            <Card>
              <CardHeader>
                <CardTitle>Team Members</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {members.map((member) => (
                    <div key={member.user_id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={member.avatar_url || undefined} />
                          <AvatarFallback>
                            {(member.full_name || 'NA').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{member.full_name || member.user_id}</p>
                          <p className="text-sm text-foreground-muted">
                            {member.role}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="secondary">
                          {member.role}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamProfile;