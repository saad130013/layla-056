
import React, { useContext, useMemo, useState } from 'react';
import { AppContext } from '../../context/AppContext';
import { useI18n } from '../../hooks/useI18n';
import { RiskCategory, UserRole, CDR, CDRManagerDecision } from '../../types';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Building, Users, Clock, AlertTriangle, FileText, CheckCircle, TrendingUp, TrendingDown, Eye } from 'lucide-react';
import PredictiveHotspotsCard from './PredictiveHotspotsCard';

const ExecutiveDashboard: React.FC = () => {
  const { locations, zones, reports, cdrs, getFormById, getLocationById, getInspectorById } = useContext(AppContext);
  const { t, language } = useI18n();
  const [compliancePeriod, setCompliancePeriod] = useState<'weekly' | 'monthly'>('weekly');

  const calculateScore = (report: any) => {
    const location = getLocationById(report.locationId);
    if (!location) return 0;
    const form = getFormById(location.formId);
    if (!form || form.items.length === 0) return 0;
    const maxScore = form.items.reduce((sum, item) => sum + item.maxScore, 0);
    const actualScore = report.items.reduce((sum, item) => sum + item.score, 0);
    return maxScore > 0 ? (actualScore / maxScore) * 100 : 0;
  };

  const riskOverview = useMemo(() => {
    const data = {
      [RiskCategory.High]: { zoneCount: 0, locationCount: 0 },
      [RiskCategory.Medium]: { zoneCount: 0, locationCount: 0 },
      [RiskCategory.Low]: { zoneCount: 0, locationCount: 0 },
    };
    zones.forEach(zone => {
      data[zone.riskCategory].zoneCount++;
      data[zone.riskCategory].locationCount += locations.filter(l => l.zoneId === zone.id).length;
    });
    return data;
  }, [zones, locations]);

  const supervisorPerformance = useMemo(() => {
      const supervisors = cdrs.map(cdr => cdr.managerSignature).filter((value, index, self) => value && self.indexOf(value) === index);
      const approvedCDRs = cdrs.filter(c => c.finalizedDate && c.status === "Approved / Final");

      let totalProcessingTime = 0;
      approvedCDRs.forEach(cdr => {
          const submittedReport = reports.find(r => r.locationId === cdr.locationId && r.inspectorId === cdr.employeeId);
          if (submittedReport && cdr.finalizedDate) {
              const submissionTime = new Date(submittedReport.date).getTime();
              const approvalTime = new Date(cdr.finalizedDate).getTime();
              totalProcessingTime += (approvalTime - submissionTime);
          }
      });
      const avgProcessingHours = approvedCDRs.length > 0 ? (totalProcessingTime / approvedCDRs.length) / (1000 * 60 * 60) : 0;
      
      const rejectedReports = cdrs.filter(c => c.managerDecision === CDRManagerDecision.NoValidCase);

      return {
          avgProcessingHours,
          rejectedReports,
      };
  }, [cdrs, reports]);

   const complianceByArea = useMemo(() => {
        const now = new Date();
        const startDate = new Date();
        if (compliancePeriod === 'weekly') {
            startDate.setDate(now.getDate() - 7);
        } else {
            startDate.setMonth(now.getMonth() - 1);
        }

        const filteredReports = reports.filter(r => new Date(r.date) >= startDate);

        return zones.map(zone => {
            const zoneReports = filteredReports.filter(r => getLocationById(r.locationId)?.zoneId === zone.id);
            const zoneCDRs = cdrs.filter(c => getLocationById(c.locationId)?.zoneId === zone.id && c.status !== 'Draft');

            const avgCompliance = zoneReports.length > 0
                ? zoneReports.reduce((sum, r) => sum + calculateScore(r), 0) / zoneReports.length
                : 100;

            const locationScores = zoneReports.reduce<Record<string, { scores: number[], count: number }>>((acc, report) => {
                if (!acc[report.locationId]) acc[report.locationId] = { scores: [], count: 0 };
                acc[report.locationId].scores.push(calculateScore(report));
                acc[report.locationId].count++;
                return acc;
            }, {});
            
            // FIX: Add explicit type for `data` from Object.entries to resolve 'unknown' type error.
            const sortedLocations = Object.entries(locationScores)
                .map(([id, data]: [string, { scores: number[]; count: number }]) => ({ name: getLocationById(id)?.name[language] || '?', score: data.count > 0 ? data.scores.reduce((a,b)=>a+b,0)/data.count : 0 }))
                .sort((a, b) => a.score - b.score);

            return {
                zone,
                avgCompliance,
                bestPerforming: sortedLocations.slice(-3).reverse(),
                worstPerforming: sortedLocations.slice(0, 3),
                openCDRs: zoneCDRs.filter(c => c.status !== "Approved / Final").length,
            };
        });
    }, [zones, reports, cdrs, compliancePeriod, calculateScore, getLocationById, language]);
  
  const getRiskColor = (risk: RiskCategory) => ({
      [RiskCategory.High]: { text: 'text-red-600', bg: 'bg-red-100', border: 'border-red-500' },
      [RiskCategory.Medium]: { text: 'text-orange-600', bg: 'bg-orange-100', border: 'border-orange-500' },
      [RiskCategory.Low]: { text: 'text-green-600', bg: 'bg-green-100', border: 'border-green-500' },
  })[risk];

  return (
    <div className="space-y-6 bg-[#F5F7FA] dark:bg-gray-900 p-4 rounded-lg">
      
      {/* 1. Risk Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* FIX: Add explicit type for `data` from Object.entries to resolve 'unknown' type error. */}
        {Object.entries(riskOverview).map(([risk, data]: [string, { zoneCount: number, locationCount: number }]) => {
          const colors = getRiskColor(risk as RiskCategory);
          return (
            <div key={risk} className={`p-4 rounded-lg ${colors.bg} dark:bg-opacity-20 border-l-4 ${colors.border}`}>
              <h3 className={`font-bold text-lg ${colors.text}`}>{t(risk.toLowerCase()+'Risk')}</h3>
              <p className="text-2xl font-black text-gray-800 dark:text-white">{data.zoneCount} {t('zones')}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{data.locationCount} {t('locations')}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">

              {/* 5. Compliance Score by Area */}
               <div>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-[#1B4965] dark:text-white">{t('complianceScoreByArea')}</h2>
                        <div className="flex gap-2">
                            <button onClick={() => setCompliancePeriod('weekly')} className={`px-3 py-1 text-sm rounded-full ${compliancePeriod === 'weekly' ? 'bg-[#1B4965] text-white' : 'bg-white dark:bg-gray-700'}`}>{t('weekly')}</button>
                            <button onClick={() => setCompliancePeriod('monthly')} className={`px-3 py-1 text-sm rounded-full ${compliancePeriod === 'monthly' ? 'bg-[#1B4965] text-white' : 'bg-white dark:bg-gray-700'}`}>{t('monthly')}</button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {complianceByArea.map(area => {
                            const colors = getRiskColor(area.zone.riskCategory);
                             const scoreColor = area.avgCompliance < 75 ? 'text-red-600' : area.avgCompliance < 90 ? 'text-orange-500' : 'text-green-600';
                            return (
                            <div key={area.zone.id} className={`p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border-t-4 ${colors.border}`}>
                                <h4 className={`font-bold ${colors.text}`}>{t(area.zone.riskCategory.toLowerCase()+'Risk')}</h4>
                                <p className={`text-4xl font-extrabold my-2 ${scoreColor}`}>{area.avgCompliance.toFixed(1)}%</p>
                                <div className="text-xs space-y-2">
                                    <h5 className="font-bold text-green-600">{t('bestPerforming')}</h5>
                                    <ul className="list-disc list-inside">
                                        {area.bestPerforming.map(l => <li key={l.name} className="truncate">{l.name} ({l.score.toFixed(0)}%)</li>)}
                                    </ul>
                                    <h5 className="font-bold text-red-600 mt-2">{t('worstPerforming')}</h5>
                                     <ul className="list-disc list-inside">
                                        {area.worstPerforming.map(l => <li key={l.name} className="truncate">{l.name} ({l.score.toFixed(0)}%)</li>)}
                                    </ul>
                                </div>
                                {area.openCDRs > 0 && <p className="text-xs text-red-600 mt-2 font-bold flex items-center gap-1"><AlertTriangle size={12} /> {area.openCDRs} {t('openCDRs')}</p>}
                            </div>
                        )})}
                    </div>
                </div>

              {/* 4. Supervisor Performance */}
              <div>
                <h2 className="text-xl font-bold text-[#1B4965] dark:text-white mb-4">{t('supervisorPerformance')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                        <h4 className="font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-2"><Clock size={16}/> {t('avgProcessingTime')}</h4>
                        <p className="text-3xl font-bold mt-2">{supervisorPerformance.avgProcessingHours.toFixed(1)} <span className="text-base font-normal">hours</span></p>
                    </div>
                     <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                        <h4 className="font-semibold text-gray-600 dark:text-gray-300">{t('rejectedReports')}</h4>
                        {supervisorPerformance.rejectedReports.length > 0 ? (
                            <ul className="text-xs mt-2 space-y-1">
                                {supervisorPerformance.rejectedReports.slice(0,2).map(r => (
                                    <li key={r.id} className="truncate">
                                        <Link to={`/cdr/${r.id}`} className="hover:underline">
                                            {r.referenceNumber}: "{r.managerComment}"
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="text-sm text-gray-400 mt-2">{t('none')}</p>}
                    </div>
                </div>
              </div>

          </div>
          <div className="lg:col-span-1 space-y-6">
              {/* 2. Heatmap & 3. Daily Activity */}
              <PredictiveHotspotsCard />
              {/* Other sidebar cards can go here */}
          </div>
      </div>
    </div>
  );
};

export default ExecutiveDashboard;
