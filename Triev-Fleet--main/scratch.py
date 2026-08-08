import re

with open('src/pages/admin/AdminDashboard.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace basic imports
text = text.replace("import { resolvePerformancePeriod, DateFilterType } from '@/utils/dateUtils';", "import { resolvePerformancePeriod, DateFilterType } from '@/utils/dateUtils';\nimport TLPerformance from '@/pages/admin/TLPerformance';\nimport { useCityOpsScope } from '@/hooks/useCityOpsScope';")

# Inject scope
text = text.replace("const Dashboard: React.FC = () => {", "const CityOpsDashboard: React.FC = () => {\n    const { cityOpsId, tlIds, isLoading: scopeLoading } = useCityOpsScope();")

# Inject scoped tlIds fetches
text = text.replace("fetchAllRidersPaginated(`", "fetchAllRidersPaginated(`")
text = text.replace("                `),", "                `, { column: 'team_leader_id', operator: 'in', value: tlIds }),")
text = text.replace("supabase.from('requests').select(`", "supabase.from('requests').select(`")
text = text.replace("                `),", "                `).in('team_leader_id', tlIds),") # Wait, is this robust?

# Let's use regex for supabase select
text = re.sub(r"supabase\.from\('requests'\)\.select\(`([\s\S]*?)`\)", r"supabase.from('requests').select(`\1`).in('team_leader_id', tlIds)", text)
text = re.sub(r"supabase\.from\('leads'\)\.select\(`([\s\S]*?)`\)", r"supabase.from('leads').select(`\1`).in('created_by', tlIds)", text)
text = re.sub(r"supabase\.from\('users'\)\.select\(`([\s\S]*?)`\)\.eq\('role', 'teamLeader'\)", r"supabase.from('users').select(`\1`).in('id', tlIds)", text)

# Fix daily_collections params
daily_old = """fetchTablePaginated('daily_collections', 'team_leader_id, total_collection, date, active_riders_count', [
                    { column: 'date', operator: 'gte', value: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)) }
                ]),"""
daily_new = """fetchTablePaginated('daily_collections', 'team_leader_id, total_collection, date, active_riders_count', [
                    { column: 'date', operator: 'gte', value: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)) },
                    { column: 'team_leader_id', operator: 'in', value: tlIds }
                ]),"""
text = text.replace(daily_old, daily_new)

text = text.replace("{ column: 'mode', operator: 'eq', value: 'ADD' },", "{ column: 'mode', operator: 'eq', value: 'ADD' },\n                    { column: 'rider.team_leader_id', operator: 'in', value: tlIds },")

# Delete component dependencies on Admin fetch
# Modify fetch block to return if no tlIds
fetch_old = "const fetchDashboardData = React.useCallback(async (isInitial = false) => {"
fetch_new = "const fetchDashboardData = React.useCallback(async (isInitial = false) => {\n        if (scopeLoading) return;\n        if (tlIds.length === 0) { setLoading(false); return; }"
text = text.replace(fetch_old, fetch_new)

# Add scope dependencies
text = text.replace("}, [dateFilter]);", "}, [dateFilter, tlIds, scopeLoading]);")
text = text.replace("}, [fetchDashboardData]);", "}, [fetchDashboardData, tlIds.length, scopeLoading]);")

# Replace header and cards
text = text.replace('export default Dashboard;', 'export default CityOpsDashboard;')
text = text.replace('{isTL ? "Team Command Center" : "Admin Command Center"}', 'City Ops Interface')
text = text.replace('<TodaysCollectionCard />', '<TodaysCollectionCard tlIds={tlIds} />')
text = text.replace('<WeeklyCollectionChart />', '<WeeklyCollectionChart tlIds={tlIds} />')

# Chop off TLPerformanceTable and Leaderboard
tables_start = text.find("{/* TL Performance Table & System Health (Admin Only) */}")
if tables_start != -1:
    text = text[:tables_start] + """
            {/* TL Performance Podium (Native Injection) */}
            <TLPerformance scopedTlIds={tlIds} />

        </div>
    );
};
export default CityOpsDashboard;
"""

with open('src/pages/cityops/CityOpsDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("Rewritten successfully.")
