// Local dummy data module for Teams, Invites, and Projects (MVP)
// Stores everything in localStorage

export type TeamMember = {
  userId: string;
  fullName: string;
  avatarUrl?: string | null;
  role: 'Owner' | 'Lead' | 'Member';
  xp?: number;
  skills?: string[];
};

export type TeamPortfolioItem = {
  id: string;
  title: string;
  description: string;
  image?: string;
  link?: string;
};

export type Team = {
  id: string;
  name: string;
  logoUrl?: string | null;
  description?: string;
  tags: string[];
  privacy: 'Public' | 'Private';
  ownerId: string;
  members: TeamMember[];
  portfolio: TeamPortfolioItem[];
  stats: {
    xp: number;
    completedProjects: number;
    followers: number;
  };
  createdAt: string;
};

export type TeamInvite = {
  id: string;
  teamId: string;
  toUserId: string;
  toUserName: string;
  fromUserId: string;
  status: 'Pending' | 'Accepted' | 'Declined';
  createdAt: string;
};

const KEYS = {
  teams: 'dummy_teams',
  invites: 'dummy_team_invites',
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function seedTeamsIfEmpty() {
  const teams = read<Team[]>(KEYS.teams, []);
  if (teams.length) return;

  const now = new Date().toISOString();
  const seed: Team[] = [
    {
      id: 'team_alpha',
      name: 'Alpha Builders',
      logoUrl: null,
      description: 'Full-stack product team focusing on fast MVPs.',
      tags: ['Web', 'MVP', 'SaaS'],
      privacy: 'Public',
      ownerId: 'owner_alpha',
      members: [
        { userId: 'owner_alpha', fullName: 'Ava Patel', role: 'Owner', xp: 2200, skills: ['React', 'Node'] },
        { userId: 'm1_alpha', fullName: 'Leo Kim', role: 'Member', xp: 1500, skills: ['UI', 'Tailwind'] },
      ],
      portfolio: [
        { id: 'p1', title: 'SaaS Dashboard', description: 'Analytics dashboard for startups.' },
      ],
      stats: { xp: 5200, completedProjects: 8, followers: 42 },
      createdAt: now,
    },
    {
      id: 'team_nova',
      name: 'Nova Mobile',
      logoUrl: null,
      description: 'Mobile-first experiences with React Native.',
      tags: ['Mobile', 'React Native'],
      privacy: 'Public',
      ownerId: 'owner_nova',
      members: [
        { userId: 'owner_nova', fullName: 'Noah Singh', role: 'Owner', xp: 3000, skills: ['React Native'] },
        { userId: 'm1_nova', fullName: 'Mia Chen', role: 'Member', xp: 1800, skills: ['UX', 'Figma'] },
      ],
      portfolio: [],
      stats: { xp: 4100, completedProjects: 5, followers: 28 },
      createdAt: now,
    },
    {
      id: 'team_ai',
      name: 'AI Collective',
      logoUrl: null,
      description: 'Applied AI/ML for real products.',
      tags: ['AI', 'ML', 'Data'],
      privacy: 'Public',
      ownerId: 'owner_ai',
      members: [
        { userId: 'owner_ai', fullName: 'Sophia Rao', role: 'Owner', xp: 5000, skills: ['Python', 'ML'] },
      ],
      portfolio: [],
      stats: { xp: 7800, completedProjects: 11, followers: 64 },
      createdAt: now,
    },
  ];

  write(KEYS.teams, seed);
  write<TeamInvite[]>(KEYS.invites, []);
}

export function getTeams(): Team[] {
  return read<Team[]>(KEYS.teams, []);
}

export function getTeamById(id: string): Team | undefined {
  return getTeams().find(t => t.id === id);
}

export function createTeam(input: Omit<Team, 'id' | 'members' | 'portfolio' | 'stats' | 'createdAt'> & { ownerName: string; ownerAvatar?: string | null }) {
  const teams = getTeams();
  if (teams.some(t => t.name.toLowerCase() === input.name.toLowerCase())) {
    throw new Error('Team name already exists');
  }
  const id = `team_${Date.now()}`;
  const team: Team = {
    id,
    name: input.name,
    logoUrl: input.logoUrl || null,
    description: input.description,
    tags: input.tags || [],
    privacy: input.privacy,
    ownerId: input.ownerId,
    members: [
      { userId: input.ownerId, fullName: input.ownerName, avatarUrl: input.ownerAvatar, role: 'Owner', xp: 0, skills: [] },
    ],
    portfolio: [],
    stats: { xp: 0, completedProjects: 0, followers: 0 },
    createdAt: new Date().toISOString(),
  };
  write(KEYS.teams, [team, ...teams]);
  return team;
}

export function userOwnsTeam(userId: string): Team | undefined {
  return getTeams().find(t => t.ownerId === userId);
}

export function inviteToTeam(teamId: string, fromUserId: string, toUserId: string, toUserName: string) {
  const invites = read<TeamInvite[]>(KEYS.invites, []);
  const id = `invite_${Date.now()}`;
  const invite: TeamInvite = { id, teamId, fromUserId, toUserId, toUserName, status: 'Pending', createdAt: new Date().toISOString() };
  write(KEYS.invites, [invite, ...invites]);
  return invite;
}

export function getInvitesForUser(userId: string) {
  const invites = read<TeamInvite[]>(KEYS.invites, []);
  return invites.filter(i => i.toUserId === userId);
}

export function respondToInvite(inviteId: string, accept: boolean) {
  const invites = read<TeamInvite[]>(KEYS.invites, []);
  const next = invites.map(i => i.id === inviteId ? { ...i, status: accept ? 'Accepted' : 'Declined' } : i);
  write(KEYS.invites, next);
  return next.find(i => i.id === inviteId);
}

export function addMember(teamId: string, member: TeamMember) {
  const teams = getTeams();
  const next = teams.map(t => {
    if (t.id !== teamId) return t;
    if (t.members.some(m => m.userId === member.userId)) return t;
    return { ...t, members: [...t.members, member] };
  });
  write(KEYS.teams, next);
}

export function leaveTeam(teamId: string, userId: string) {
  const teams = getTeams();
  const next = teams.map(t => t.id === teamId ? { ...t, members: t.members.filter(m => m.userId !== userId) } : t);
  write(KEYS.teams, next);
}

export function dissolveTeam(teamId: string) {
  const teams = getTeams();
  const next = teams.filter(t => t.id !== teamId);
  write(KEYS.teams, next);
}
