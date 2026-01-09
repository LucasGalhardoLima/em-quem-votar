import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

interface MatchRadarChartProps {
    data: {
        subject: string;
        user: number;
        politician: number;
        fullMark: number;
    }[];
}

export function MatchRadarChart({ data }: MatchRadarChartProps) {
    return (
        <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#6b7280', fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />

                    {/* User Radar */}
                    <Radar
                        name="Você"
                        dataKey="user"
                        stroke="#2563eb"
                        fill="#3b82f6"
                        fillOpacity={0.6}
                    />

                    {/* Politician Radar */}
                    <Radar
                        name="Político"
                        dataKey="politician"
                        stroke="#9ca3af"
                        fill="#9ca3af"
                        fillOpacity={0.3}
                    />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
}
