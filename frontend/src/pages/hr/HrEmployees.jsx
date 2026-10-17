import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  MdPerson, MdSearch, MdFilterList, MdGroups, MdMedicalServices, MdPeople,
  MdLocalHospital, MdScience, MdLocalPharmacy, MdBadge, MdAssignment, MdCheckCircle,
  MdWarning, MdRefresh, MdVisibility, MdEdit,
} from 'react-icons/md';
import api from '../../utils/api';
import Badge from '../../components/Badge';
import Pagination from '../../components/Pagination';

const availabilityVariant = (status) => {
  if (status === 'Available') return 'green';
  if (status === 'Assigned') return 'blue';
  if (status === 'Busy') return 'red';
  if (status === 'Off Shift') return 'gray';
  return 'gray';
};

const roleVariant = (role) => {
  if (!role) return 'gray';
  const r = typeof role === 'string' ? role.toLowerCase() : '';
  if (r.includes('doctor')) return 'purple';
  if (r.includes('nurse')) return 'emerald';
  if (r.includes('reception')) return 'amber';
  if (r.includes('pharmacist')) return 'cyan';
  if (r.includes('lab')) return 'rose';
  if (r.includes('hr')) return 'indigo';
  if (r.includes('ot')) return 'orange';
  return 'gray';
};

export default function HrEmployees() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [employees, setEmployees] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [roleFilter, setRoleFilter] = useState(searchParams.get('role') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [availabilityFilter, setAvailabilityFilter] = useState(searchParams.get('availability') || '');
  const [departmentFilter, setDepartmentFilter] = useState(searchParams.get('department') || '');

  const page = Number(searchParams.get('page')) || 1;
  const pageSize = 20;

  const fetchEmployees = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = { page: p, pageSize };
      if (search.trim()) params.search = search.trim();
      if (roleFilter) params.role = roleFilter;
      if (statusFilter) params.status = statusFilter;
      if (availabilityFilter) params.availability = availabilityFilter;
      if (departmentFilter) params.department = departmentFilter;

      const res = await api.get('/hr/employees', { params });
      setEmployees(Array.isArray(res.data?.employees) ? res.data.employees : []);
      setSummary(res.data?.summary || null);
      setPagination(res.data?.pagination || { page: p, totalPages: 1 });
    } catch {
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter, availabilityFilter, departmentFilter]);

  useEffect(() => {
    fetchEmployees(page);
  }, [fetchEmployees, page]);

  const handlePageChange = (p) => {
    setSearchParams((prev) => { prev.set('page', String(p)); return prev; });
  };

  const applyFilters = () => {
    setSearchParams((prev) => {
      if (search.trim()) prev.set('search', search.trim());
      else prev.delete('search');
      if (roleFilter) prev.set('role', roleFilter);
      else prev.delete('role');
      if (statusFilter) prev.set('status', statusFilter);
      else prev.delete('status');
      if (availabilityFilter) prev.set('availability', availabilityFilter);
      else prev.delete('availability');
      if (departmentFilter) prev.set('department', departmentFilter);
      else prev.delete('department');
      prev.set('page', '1');
      return prev;
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') applyFilters();
  };

  const statCards = summary ? [
    { label: 'Total Employees', value: summary.total, icon: MdGroups, tone: 'blue' },
    { label: 'Doctors', value: summary.doctors, icon: MdMedicalServices, tone: 'purple' },
    { label: 'Nurses', value: summary.nurses, icon: MdLocalHospital, tone: 'emerald' },
    { label: 'Receptionists', value: summary.receptionists, icon: MdPeople, tone: 'amber' },
    { label: 'OT Technicians', value: summary.otTechnicians, icon: MdBadge, tone: 'orange' },
    { label: 'Lab Technicians', value: summary.labTechnicians, icon: MdScience, tone: 'rose' },
    { label: 'Pharmacists', value: summary.pharmacists, icon: MdLocalPharmacy, tone: 'cyan' },
    { label: 'Assigned', value: summary.currentlyAssigned, icon: MdAssignment, tone: 'indigo' },
    { label: 'Available', value: summary.available, icon: MdCheckCircle, tone: 'green' },
  ] : [];

  return (
    <div className="w-full max-w-none bg-gradient-to-b from-slate-50/50 to-gray-50 min-h-screen">
      <div className="space-y-6 px-4 py-6 sm:px-6 pb-12">
        {/* Top bar header banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#0077B6] shadow-sm shrink-0">
              <MdGroups className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-0.5">
              <h1 className="text-2xl font-extrabold text-[#001B48] tracking-tight">Employee Management</h1>
              <p className="text-sm font-semibold text-gray-500">
                Central workforce registry — assign clinical duties, coordinate departments, and view staffing availability
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fetchEmployees(page)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-[#0077B6] border border-blue-150 bg-blue-50/50 hover:bg-blue-50 active:scale-95 transition-all duration-200 shrink-0 self-start sm:self-auto"
          >
            <MdRefresh className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {statCards.map((s) => (
              <StatCardContainer key={s.label} {...s} />
            ))}
          </div>
        )}

        {/* Search & Filters */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <MdSearch className="absolute left-3.5 top-3 text-gray-400 w-5 h-5" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search by Name, ID, Email, Mobile..."
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all"
            >
              <option value="">All Roles</option>
              <option value="doctor">Doctors</option>
              <option value="nurse">Nurses</option>
              <option value="receptionist">Receptionists</option>
              <option value="pharmacist">Pharmacists</option>
              <option value="lab_technician">Lab Technicians</option>
              <option value="hr_manager">HR Managers</option>
              <option value="ot_technician">OT Technicians</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <select
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value)}
              className="px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all"
            >
              <option value="">All Availability</option>
              <option value="available">Available</option>
              <option value="assigned">Assigned</option>
              <option value="busy">Busy</option>
            </select>

            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#0077B6] focus:ring-1 focus:ring-[#0077B6]/20 transition-all"
            >
              <option value="">All Departments</option>
              <option value="OPD">OPD</option>
              <option value="IPD">IPD</option>
              <option value="OT">OT</option>
              <option value="Lab">Lab</option>
              <option value="Pharmacy">Pharmacy</option>
              <option value="Administration">Administration</option>
            </select>

            <button
              type="button"
              onClick={applyFilters}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-[#0077B6] hover:bg-[#005B8C] shadow-sm hover:shadow active:scale-95 transition-all duration-200 shrink-0"
            >
              <MdFilterList className="w-4 h-4" />
              Apply
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/20">
            <p className="font-extrabold text-[#001B48]">Employee Registry</p>
            <p className="text-xs font-bold text-gray-400">
              Page {pagination.page} of {pagination.totalPages}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50/70">
                <tr>
                  <th className="px-3 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">Employee ID</th>
                  <th className="px-3 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">Name</th>
                  <th className="px-3 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">Role</th>
                  <th className="px-3 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">Department</th>
                  <th className="px-3 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">Shift</th>
                  <th className="px-3 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-center">Patients</th>
                  <th className="px-3 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-center">OT Cases</th>
                  <th className="px-3 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">Availability</th>
                  <th className="px-3 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">Status</th>
                  <th className="px-3 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {loading ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-gray-500 font-semibold animate-pulse" colSpan={10}>
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-[#0077B6] border-t-transparent rounded-full animate-spin"></div>
                        Loading employees registry...
                      </div>
                    </td>
                  </tr>
                ) : employees.length === 0 ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-gray-550 font-semibold bg-white" colSpan={10}>
                      No matching employee records found.
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => (
                    <tr
                      key={emp.id}
                      className="hover:bg-gray-50/50 cursor-pointer transition-colors duration-150"
                      onClick={() => navigate('/dashboard/hr/employees/' + emp.id)}
                    >
                      <td className="px-3 py-2.5 whitespace-nowrap font-mono text-xs font-bold text-[#0077B6]">
                        {emp.employeeId || '—'}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-50 text-[#0077B6] flex items-center justify-center shrink-0 shadow-sm border border-blue-100">
                            <MdPerson className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <p className="font-bold text-[#001B48] leading-normal">{emp.name}</p>
                            <p className="text-[11px] text-gray-400 font-semibold leading-normal">{emp.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <Badge variant={roleVariant(emp.role)}>{emp.role}</Badge>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-semibold text-gray-650 text-xs">
                        {emp.department || '—'}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs font-semibold text-gray-500">
                        {emp.currentShift || '—'}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-center font-extrabold text-gray-800">
                        {emp.assignedPatientsCount || 0}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-center font-extrabold text-gray-800">
                        {emp.assignedOtCasesCount || 0}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <Badge variant={availabilityVariant(emp.availabilityStatus)}>{emp.availabilityStatus}</Badge>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <Badge variant={emp.isActive === false ? 'gray' : 'green'}>
                          {emp.isActive === false ? 'Inactive' : 'Active'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => navigate('/dashboard/hr/employees/' + emp.id)}
                            className="p-1 rounded-lg hover:bg-blue-50 text-[#0077B6] transition border border-transparent hover:border-blue-100 active:scale-95"
                            title="View Details"
                          >
                            <MdVisibility className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate('/dashboard/hr/employees/' + emp.id)}
                            className="p-1 rounded-lg hover:bg-green-50 text-green-600 transition border border-transparent hover:border-green-100 active:scale-95"
                            title="Edit"
                          >
                            <MdEdit className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/20">
            <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={handlePageChange} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCardContainer({ label, value, icon: Icon, tone }) {
  const tones = {
    blue: { bg: '#E0F2FE', fg: '#0077B6' },
    navy: { bg: '#E8F1F5', fg: '#001B48' },
    amber: { bg: '#FEF3C7', fg: '#B45309' },
    teal: { bg: '#CCFBF1', fg: '#0F766E' },
    purple: { bg: '#F3E8FF', fg: '#7E22CE' },
    emerald: { bg: '#D1FAE5', fg: '#047857' },
    rose: { bg: '#FFE4E6', fg: '#BE123C' },
    orange: { bg: '#FFEDD5', fg: '#C2410C' },
    cyan: { bg: '#CFFAFE', fg: '#0E7490' },
    indigo: { bg: '#E0E7FF', fg: '#4338CA' },
    red: { bg: '#FEE2E2', fg: '#B91C1C' },
    green: { bg: '#DCFCE7', fg: '#15803D' },
  };
  const t = tones[tone] || tones.blue;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition duration-200 hover:shadow-md hover:-translate-y-0.5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-opacity-70" style={{ background: t.bg }}>
          <Icon className="w-5 h-5" style={{ color: t.fg }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider truncate">{label}</p>
          <p className="text-lg font-extrabold text-[#001B48] mt-0.5">{value}</p>
        </div>
      </div>
    </div>
  );
}
