import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Star, Users, Hash } from "lucide-react";
import { format } from "date-fns";

interface RatingRow {
  id: string;
  rating: number;
  comment: string | null;
  rater_name: string;
  rated_name: string;
  created_at: string;
}

interface TopUser {
  name: string;
  avgRating: number;
  ratingCount: number;
}

const chartConfig: ChartConfig = {
  count: { label: "Ratings", color: "hsl(45, 93%, 47%)" },
};

export const RatingsTab = () => {
  const [ratings, setRatings] = useState<RatingRow[]>([]);
  const [distribution, setDistribution] = useState<{ stars: string; count: number }[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [totalRatings, setTotalRatings] = useState(0);
  const [avgRating, setAvgRating] = useState(0);
  const [usersRated, setUsersRated] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRatings();
  }, []);

  const fetchRatings = async () => {
    try {
      const { data: ratingsData } = await supabase
        .from('user_ratings')
        .select('id, rating, comment, created_at, rated_user_id, rater_user_id')
        .order('created_at', { ascending: false });

      const userIds = new Set<string>();
      ratingsData?.forEach(r => {
        userIds.add(r.rated_user_id);
        userIds.add(r.rater_user_id);
      });

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', Array.from(userIds));

      const profileMap: Record<string, string> = {};
      profiles?.forEach(p => { profileMap[p.id] = p.name; });

      const rows: RatingRow[] = (ratingsData || []).map(r => ({
        id: r.id,
        rating: r.rating || 0,
        comment: r.comment,
        rater_name: profileMap[r.rater_user_id] || 'Unknown',
        rated_name: profileMap[r.rated_user_id] || 'Unknown',
        created_at: r.created_at || '',
      }));

      setRatings(rows);

      // Stats
      const validRatings = rows.filter(r => r.rating > 0);
      setTotalRatings(validRatings.length);
      const avg = validRatings.length > 0 ? validRatings.reduce((s, r) => s + r.rating, 0) / validRatings.length : 0;
      setAvgRating(Math.round(avg * 10) / 10);
      const ratedUsers = new Set(ratingsData?.map(r => r.rated_user_id) || []);
      setUsersRated(ratedUsers.size);

      // Distribution
      const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      validRatings.forEach(r => {
        const bucket = Math.min(5, Math.max(1, Math.round(r.rating)));
        dist[bucket]++;
      });
      setDistribution(Object.entries(dist).map(([stars, count]) => ({ stars: `${stars} star`, count })));

      // Top rated users (min 1 rating)
      const userRatings: Record<string, { total: number; count: number; name: string }> = {};
      ratingsData?.forEach(r => {
        if (!r.rating) return;
        const name = profileMap[r.rated_user_id] || 'Unknown';
        if (!userRatings[r.rated_user_id]) {
          userRatings[r.rated_user_id] = { total: 0, count: 0, name };
        }
        userRatings[r.rated_user_id].total += r.rating;
        userRatings[r.rated_user_id].count++;
      });

      const top = Object.values(userRatings)
        .map(u => ({ name: u.name, avgRating: Math.round((u.total / u.count) * 10) / 10, ratingCount: u.count }))
        .sort((a, b) => b.avgRating - a.avgRating || b.ratingCount - a.ratingCount)
        .slice(0, 10);
      setTopUsers(top);
    } catch (error) {
      // Failed to fetch ratings
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8">Loading ratings...</div>;

  const statCards = [
    { title: "Total Ratings", value: totalRatings, icon: Hash, color: "text-blue-600" },
    { title: "Avg Rating", value: avgRating, icon: Star, color: "text-yellow-600" },
    { title: "Users Rated", value: usersRated, icon: Users, color: "text-purple-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.title}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-4 h-4 ${s.color}`} />
                  <p className="text-sm text-muted-foreground">{s.title}</p>
                </div>
                <p className="text-2xl font-bold">{s.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rating Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <BarChart data={distribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="stars" fontSize={12} tickLine={false} />
                <YAxis fontSize={12} tickLine={false} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Rated Users</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead className="text-right">Avg Rating</TableHead>
                  <TableHead className="text-right">Reviews</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topUsers.map((u, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-right">{u.avgRating}</TableCell>
                    <TableCell className="text-right">{u.ratingCount}</TableCell>
                  </TableRow>
                ))}
                {topUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">No ratings yet</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Ratings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rated User</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Comment</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ratings.slice(0, 20).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.rated_name}</TableCell>
                    <TableCell>{r.rater_name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        {r.rating}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{r.comment || '-'}</TableCell>
                    <TableCell>{r.created_at ? format(new Date(r.created_at), 'MMM d, yyyy') : ''}</TableCell>
                  </TableRow>
                ))}
                {ratings.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">No ratings yet</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
