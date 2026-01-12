import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from 'recharts';

interface MatchRadarChartProps {
    data: {
        subject: string;
        user: number;
        politician: number;
        fullMark: number;
    }[];
}

export function MatchRadarChart({ data }: MatchRadarChartProps) {
    if (!data || data.length === 0) return null;

    return (
        <div className="w-full h-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="85%" data={data}>
                    {/* Grid for light background */}
                    <PolarGrid stroke="rgba(0,0,0,0.1)" />

                    {/* Readable Axis Labels */}
                    <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fill: 'var(--color-brand-tertiary)', fontSize: 13, fontWeight: 700 }}
                        tickSize={15}
                    />

                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />

                    <Legend wrapperStyle={{ paddingTop: '10px' }} />

                    {/* User Radar - Bright Cyan */}
                    <Radar
                        name="Você"
                        dataKey="user"
                        stroke="var(--color-brand-secondary)"
                        fill="var(--color-brand-secondary)"
                        fillOpacity={0.4}
                    />

                    {/* Politician Radar - Bright Yellow */}
                    <Radar
                        name="Político"
                        dataKey="politician"
                        stroke="var(--color-brand-primary)"
                        fill="var(--color-brand-primary)"
                        fillOpacity={0.6}
                    />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
}
