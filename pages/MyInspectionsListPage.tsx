
import React, { useContext, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { useI18n } from '../hooks/useI18n';
import Card from '../components/ui/Card';
import { ReportStatus } from '../types';
import { Filter, Search, ArrowRight, ClipboardList, BarChart2, AlertTriangle, Eye } from 'lucide-react';

const MyInspectionsListPage: React.FC = () => {
    const { user, reports, getLocationById, getFormById } = useContext(AppContext);
    const { t, language } = useI18n();
    const navigate = useNavigate();

    const [filters, setFilters] = useState({
        searchText: '',
        status: '',
        dateFrom: '',
        dateTo: ''
    });

    const calculateScore = (report: any) => {
        const location = getLocationById(report.locationId);
        if (!location) return 0;
        const form = getFormById(location.formId);
        if (!form || form.items.length === 0) return 0;
        const maxScore = form.items.reduce((sum: number, item: any) => sum + item.maxScore, 0);
        const actualScore = report.items.reduce((sum: number, item: any) => sum + item.score, 0);
        return maxScore > 0 ? (actualScore / maxScore) * 100 : 0;
    };

    const myReports = useMemo(() => {
        if (!user) return [];
        
        return reports
            .filter(r => r.inspectorId === user.id)
            .map(r => ({
                ...r,
                score: calculateScore(r),
                locationName: getLocationById(r.locationId)?.name[language] || ''
            }))
            .filter(r => {
                const reportDate = new Date(r.date);
                const dateFrom = filters.dateFrom ? new Date(filters.dateFrom) : null;
                const dateTo = filters.dateTo ? new Date(filters.dateTo) : null;
                if(dateFrom) dateFrom.setHours(0,0,0,0);
                if(dateTo) dateTo.setHours(23,59,59,999);

                const matchesSearch = 
                    r.referenceNumber.toLowerCase().includes(filters.searchText.toLowerCase()) ||
                    r.locationName.toLowerCase().includes(filters.searchText.toLowerCase());

                const matchesStatus = !filters.status || r.status === filters.status;
                const matchesDate = (!dateFrom || reportDate >= dateFrom) && (!dateTo || reportDate <= dateTo);

                return matchesSearch && matchesStatus && matchesDate;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [reports, user, filters, getLocationById, getFormById, language]);

    const kpiStats = useMemo(() => {
        const total = myReports.length;
        const avgScore = total > 0 ? myReports.reduce((acc, r) => acc + r.score, 0) / total : 0;
        const criticalCount = myReports.filter(r => r.score < 75).length;
        return { total, avgScore, criticalCount };
    }, [myReports]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
    };

    const getScoreColor = (score: number) => {
        if (score >= 90) return 'text-green-600 bg-green-100 dark:bg-green-900/20';
        if (score >= 75) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
        return 'text-red-600 bg-red-100 dark:bg-red-900/20';
    };

    const KPICard = ({ title, value, icon, color }: any) => (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border-t-4 border-transparent hover:border-brand-teal transition-all">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">{title}</p>
                    <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-full text-gray-400">
                    {icon}
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-brand-blue-dark dark:text-gray-200">{t('myInspectionsList')}</h1>
                <button 
                    onClick={() => navigate('/new-inspection')}
                    className="flex items-center px-4 py-2 bg-brand-teal text-white font-semibold rounded-md shadow-sm hover:bg-brand-blue-dark transition-colors"
                >
                    {t('newInspection')} <ArrowRight size={16} className="ms-2"/>
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <KPICard 
                    title={t('totalReports')} 
                    value={kpiStats.total} 
                    icon={<ClipboardList size={24}/>} 
                    color="text-brand-blue-dark dark:text-white"
                />
                <KPICard 
                    title={t('averageScore')} 
                    value={kpiStats.avgScore.toFixed(1) + '%'} 
                    icon={<BarChart2 size={24}/>} 
                    color={kpiStats.avgScore >= 85 ? 'text-green-600' : kpiStats.avgScore >= 75 ? 'text-yellow-600' : 'text-red-600'}
                />
                <KPICard 
                    title={t('criticalIssues')} 
                    value={kpiStats.criticalCount} 
                    icon={<AlertTriangle size={24}/>} 
                    color={kpiStats.criticalCount > 0 ? 'text-red-600' : 'text-green-600'}
                />
            </div>

            {/* Filters */}
            <Card>
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute start-3 top-2.5 text-gray-400 w-5 h-5" />
                        <input 
                            type="text" 
                            name="searchText"
                            placeholder={t('searchByNameOrLocation')} 
                            value={filters.searchText}
                            onChange={handleFilterChange}
                            className="w-full ps-10 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                        />
                    </div>
                    <select 
                        name="status" 
                        value={filters.status} 
                        onChange={handleFilterChange}
                        className="p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 min-w-[150px]"
                    >
                        <option value="">{t('status')} (All)</option>
                        {Object.values(ReportStatus).map(s => <option key={s} value={s}>{t(s.replace(/\s/g, ''))}</option>)}
                    </select>
                    <input 
                        type="date" 
                        name="dateFrom" 
                        value={filters.dateFrom} 
                        onChange={handleFilterChange} 
                        className="p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                    />
                    <input 
                        type="date" 
                        name="dateTo" 
                        value={filters.dateTo} 
                        onChange={handleFilterChange} 
                        className="p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                    />
                </div>
            </Card>

            {/* List */}
            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3">{t('referenceNumber')}</th>
                                <th className="px-6 py-3">{t('date')}</th>
                                <th className="px-6 py-3">{t('location')}</th>
                                <th className="px-6 py-3 text-center">{t('score')}</th>
                                <th className="px-6 py-3">{t('status')}</th>
                                <th className="px-6 py-3 text-center">{t('view')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {myReports.length > 0 ? myReports.map(report => (
                                <tr key={report.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <td className="px-6 py-4 font-medium">{report.referenceNumber}</td>
                                    <td className="px-6 py-4 text-gray-500">{new Date(report.date).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 font-medium text-gray-800 dark:text-gray-200">{report.locationName}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${getScoreColor(report.score)}`}>
                                            {report.score.toFixed(1)}%
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300`}>
                                            {t(report.status.replace(/\s/g, ''))}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <Link to={`/report/${report.id}`} className="text-brand-blue hover:bg-blue-50 p-2 rounded-full inline-block transition-colors">
                                            <Eye size={18} />
                                        </Link>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-gray-500">
                                        {t('noReportsFound')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default MyInspectionsListPage;
