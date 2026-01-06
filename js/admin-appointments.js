(function (global) {
    var state = {
        appointments: [],
        staff: [],
        selectedAppointment: null,
        loading: false,
        pagination: null
    };

    var CURRENT_PAGE = 1;
    var SEARCH_DEBOUNCE_TIMER = null;

    function escapeHtml(text) {
        if (text === null || text === undefined) {
            return '';
        }
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatDate(iso) {
        if (global.DateUtils && typeof global.DateUtils.formatDateTime === 'function') {
            return global.DateUtils.formatDateTime(iso);
        }

        // Fallback if DateUtils is not loaded
        if (!iso) {
            return '—';
        }
        var d = new Date(iso);
        if (isNaN(d.getTime())) {
            return '—';
        }
        return d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0') + ' ' +
            String(d.getHours()).padStart(2, '0') + ':' +
            String(d.getMinutes()).padStart(2, '0') + ':' +
            String(d.getSeconds()).padStart(2, '0');
    }

    function formatMoney(value) {
        if (value === null || value === undefined || value === '') {
            return '-';
        }
        var n = Number(value);
        if (isNaN(n)) {
            return '-';
        }
        return '$' + n.toFixed(2);
    }

    function setLoading(isLoading) {
        state.loading = isLoading;
        global.jQuery('#admin-appointments-loading').toggleClass('hidden', !isLoading);
    }

    function hydrateFiltersFromQuery() {
        try {
            var params = new URLSearchParams(global.location.search);
            var status = params.get('status');
            var page = params.get('page');
            var q = params.get('q');

            if (status) {
                global.jQuery('#status').val(status);
            } else {
                // Default to "all" when no status is specified
                global.jQuery('#status').val('all');
            }
            if (q) global.jQuery('#search').val(q);
            if (page) CURRENT_PAGE = parseInt(page, 10) || 1;
        } catch (e) {
            // Default to most recent if hydration fails
            global.jQuery('#status').val('most_recent');
        }
    }

    function buildAppointmentsUrl() {
        var status = global.jQuery('#status').val();

        var url = Api.getBaseUrl() + '/admin/appointments';
        var params = [];

        // Only apply status filter if it's not "all"
        if (status && status !== 'all') {
            params.push('status=' + encodeURIComponent(status));
        }
        if (CURRENT_PAGE && CURRENT_PAGE > 1) {
            params.push('page=' + encodeURIComponent(CURRENT_PAGE));
        }

        if (params.length) {
            url += '?' + params.join('&');
        }

        return url;
    }

    function showAlert(type, message) {
        var alertClass = type === 'success'
            ? 'bg-green-50 border-l-4 border-green-500 text-green-700'
            : 'bg-red-50 border-l-4 border-red-500 text-red-700';

        var icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';

        var html = '<div class="' + alertClass + ' p-4 mb-4 rounded shadow-sm">'
            + '<div class="flex items-center">'
            + '<i class="fas ' + icon + ' mr-3 text-lg"></i>'
            + '<div class="font-medium">' + escapeHtml(message) + '</div>'
            + '</div>'
            + '</div>';

        global.jQuery('#alert-container').html(html);
    }

    function fetchAppointments() {
        return Api.request({
            url: buildAppointmentsUrl(),
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        }).then(function (res) {
            var items = res && res.data && res.data.appointments;
            var pagination = res && res.data && res.data.pagination;
            state.appointments = Array.isArray(items) ? items : [];
            state.pagination = pagination || null;
            return state.appointments;
        });
    }

    function fetchAppointment(id) {
        return Api.request({
            url: Api.getBaseUrl() + '/admin/appointments/' + id,
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        }).then(function (res) {
            var appointment = res && res.data && res.data.appointment;
            return appointment || null;
        });
    }

    function fetchStaff() {
        return Api.request({
            url: Api.getBaseUrl() + '/admin/staff',
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        }).then(function (res) {
            var items = res && res.data && res.data.staff;
            state.staff = Array.isArray(items) ? items : [];
            return state.staff;
        });
    }

    function renderAppointmentsTable(items) {
        var $tbody = global.jQuery('#admin-appointments-tbody');
        $tbody.empty();

        var list = Array.isArray(items) ? items : (Array.isArray(state.appointments) ? state.appointments : []);

        if (!list.length) {
            global.jQuery('#admin-appointments-empty').removeClass('hidden');
            return;
        }

        global.jQuery('#admin-appointments-empty').addClass('hidden');

        list.forEach(function (a) {
            var status = AppointmentRules.normalizeStatus(a.status);
            var statusColor = AppointmentRules.getStatusBadgeColor(status);

            var customer = a.user && a.user.name ? a.user.name : '-';
            var vehicle = a.vehicle && a.vehicle.full_name ? a.vehicle.full_name : '-';
            var staff = a.staff && a.staff.name ? a.staff.name : 'Unassigned';
            var servicesText = (a.services || []).map(function (s) {
                return s && s.name ? s.name : '';
            }).filter(function (x) {
                return !!x;
            }).join(', ');

            var row = '<tr>'
                + '<td class="px-6 py-4 whitespace-nowrap text-sm">' + escapeHtml(formatDate(a.appointment_date)) + '</td>'
                + '<td class="px-6 py-4 whitespace-nowrap text-sm">' + escapeHtml(customer) + '</td>'
                + '<td class="px-6 py-4 whitespace-nowrap text-sm">' + escapeHtml(vehicle) + '</td>'
                + '<td class="px-6 py-4 text-sm">' + escapeHtml(servicesText || '-') + '</td>'
                + '<td class="px-6 py-4 whitespace-nowrap">'
                + '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-' + statusColor + '-100 text-' + statusColor + '-800">'
                + escapeHtml(status ? (status.charAt(0).toUpperCase() + status.slice(1)) : '-')
                + '</span>'
                + '</td>'
                + '<td class="px-6 py-4 whitespace-nowrap text-sm">' + escapeHtml(staff) + '</td>'
                + '<td class="px-6 py-4 whitespace-nowrap text-right text-sm">'
                + '<button type="button" class="border-2 border-black bg-transparent hover:bg-black text-black hover:text-white px-3 py-1 rounded transition text-sm font-medium"'
                + ' data-action="view" data-id="' + escapeHtml(a.id) + '">View</button>'
                + '</td>'
                + '</tr>';

            $tbody.append(row);
        });
    }

    function applySearchFilterAndRender() {
        var q = String(global.jQuery('#search').val() || '').trim().toLowerCase();
        var appointmentsToFilter = state.appointments || [];

        if (!q) {
            renderAppointmentsTable(appointmentsToFilter);
            return;
        }

        // Search across multiple fields: customer name, vehicle info, service type, appointment ID
        var filtered = appointmentsToFilter.filter(function (a) {
            // Customer name and email
            var customerName = a && a.user ? (a.user.name || '') : '';
            var customerEmail = a && a.user ? (a.user.email || '') : '';
            
            // Vehicle information
            var vehicleName = a && a.vehicle ? (a.vehicle.full_name || '') : '';
            var vehiclePlate = a && a.vehicle ? (a.vehicle.license_plate || '') : '';
            
            // Service types
            var services = (a && a.services && a.services.length) 
                ? a.services.map(function (s) { return s && s.name ? s.name : ''; }).join(' ') 
                : '';
            
            // Appointment ID
            var appointmentId = a && a.id ? String(a.id) : '';
            
            // Status
            var status = a && a.status ? String(a.status) : '';
            
            // Combine all searchable fields
            var haystack = (
                customerName + ' ' + 
                customerEmail + ' ' + 
                vehicleName + ' ' + 
                vehiclePlate + ' ' + 
                services + ' ' + 
                appointmentId + ' ' + 
                status
            ).toLowerCase();
            
            return haystack.indexOf(q) !== -1;
        });

        renderAppointmentsTable(filtered);
    }

    function updatePaginationControls() {
        var pagination = state.pagination;
        if (!pagination) {
            global.jQuery('#pagination').addClass('hidden');
            return;
        }

        global.jQuery('#pagination').removeClass('hidden');
        global.jQuery('#page-info').text('Page ' + pagination.current_page + ' of ' + pagination.last_page);
        CURRENT_PAGE = pagination.current_page;
        global.jQuery('#btn-prev').prop('disabled', pagination.current_page <= 1);
        global.jQuery('#btn-next').prop('disabled', pagination.current_page >= pagination.last_page);
    }

    function loadAppointments() {
        setLoading(true);
        global.jQuery('#admin-appointments-empty').addClass('hidden');
        global.jQuery('#pagination').addClass('hidden');

        fetchAppointments().done(function () {
            // Apply search filter on the fetched results
            applySearchFilterAndRender();
            updatePaginationControls();
        }).fail(function (xhr) {
            var errorMsg = 'Failed to load admin appointments.';
            try {
                if (xhr && xhr.responseJSON && xhr.responseJSON.message) {
                    errorMsg = xhr.responseJSON.message;
                }
            } catch (e) {}
            showAlert('error', errorMsg);
            renderAppointmentsTable([]);
        }).always(function () {
            setLoading(false);
        });
    }

    function findAppointmentById(id) {
        for (var i = 0; i < state.appointments.length; i++) {
            if (String(state.appointments[i].id) === String(id)) {
                return state.appointments[i];
            }
        }
        return null;
    }

    function renderAppointmentDetails(appointment) {
        state.selectedAppointment = appointment;

        if (!appointment) {
            global.jQuery('#admin-appointment-details').addClass('hidden');
            global.jQuery('#admin-appointment-placeholder').removeClass('hidden');
            return;
        }

        global.jQuery('#admin-appointment-details').removeClass('hidden');
        global.jQuery('#admin-appointment-placeholder').addClass('hidden');

        var status = AppointmentRules.normalizeStatus(appointment.status);
        var lockReason = AppointmentRules.getStaffAssignmentLockReason(appointment);

        global.jQuery('#detail-id').text(appointment.id || '-');
        global.jQuery('#detail-status').text(status ? (status.charAt(0).toUpperCase() + status.slice(1)) : '-');
        global.jQuery('#detail-date').text(formatDate(appointment.appointment_date));
        global.jQuery('#detail-end-time').text(formatDate(appointment.end_time));
        global.jQuery('#detail-customer').text((appointment.user && appointment.user.name) ? appointment.user.name : '-');
        global.jQuery('#detail-customer-email').text((appointment.user && appointment.user.email) ? appointment.user.email : '-');
        global.jQuery('#detail-vehicle').text((appointment.vehicle && appointment.vehicle.full_name) ? appointment.vehicle.full_name : '-');
        global.jQuery('#detail-plate').text((appointment.vehicle && appointment.vehicle.license_plate) ? appointment.vehicle.license_plate : '-');
        global.jQuery('#detail-staff').text((appointment.staff && appointment.staff.name) ? appointment.staff.name : 'Unassigned');
        global.jQuery('#detail-total').text(formatMoney(appointment.total_price));
        global.jQuery('#detail-created-at').text(formatDate(appointment.created_at));
        global.jQuery('#detail-updated-at').text(formatDate(appointment.updated_at));
        global.jQuery('#detail-paid-at').text(formatDate(appointment.paid_at));

        renderServices(appointment);

        var $lockBanner = global.jQuery('#admin-assignment-locked-banner');
        var $assignBox = global.jQuery('#admin-assign-box');

        if (lockReason) {
            $assignBox.addClass('hidden');
            $lockBanner.removeClass('hidden');
        } else {
            $lockBanner.addClass('hidden');
            $assignBox.removeClass('hidden');
        }

        renderStaffOptions(appointment);
    }

    function renderServices(appointment) {
        var services = appointment && appointment.services ? appointment.services : [];
        var $list = global.jQuery('#detail-services');
        var $empty = global.jQuery('#detail-services-empty');

        $list.empty();

        if (!Array.isArray(services) || !services.length) {
            $empty.removeClass('hidden');
            return;
        }

        $empty.addClass('hidden');
        services.forEach(function (s) {
            var name = s && s.name ? s.name : 'Service';
            var price = (s && (s.price !== null && s.price !== undefined)) ? formatMoney(s.price) : '';
            var label = price && price !== '-' ? (name + ' (' + price + ')') : name;
            $list.append('<li>' + escapeHtml(label) + '</li>');
        });
    }

    function renderStaffOptions(appointment) {
        var $select = global.jQuery('#staff-select');
        $select.empty();

        $select.append('<option value="">Select Staff</option>');

        state.staff.forEach(function (s) {
            var label = s && (s.name || s.username || s.email) ? (s.name || s.username || s.email) : ('Staff #' + s.id);
            $select.append('<option value="' + escapeHtml(s.id) + '">' + escapeHtml(label) + '</option>');
        });

        if (appointment && appointment.staff && appointment.staff.id) {
            $select.val(String(appointment.staff.id));
        } else {
            $select.val('');
        }
    }

    function assignStaff() {
        var appointment = state.selectedAppointment;
        if (!appointment) {
            showAlert('error', 'No appointment selected.');
            return;
        }

        if (AppointmentRules.isStaffAssignmentLocked(appointment)) {
            showAlert('error', 'Staff assignment is locked for this appointment.');
            return;
        }

        var staffId = global.jQuery('#staff-select').val();
        if (!staffId) {
            showAlert('error', 'Please select a staff member.');
            return;
        }

        var $btn = global.jQuery('#assign-staff-btn');
        $btn.prop('disabled', true).text('Assigning...');

        Api.request({
            url: Api.getBaseUrl() + '/admin/appointments/' + appointment.id + '/assign-staff',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ staff_id: staffId }),
            headers: { 'Accept': 'application/json' }
        }).done(function (res) {
            if (res && res.success && res.data && res.data.appointment) {
                var updated = res.data.appointment;

                for (var i = 0; i < state.appointments.length; i++) {
                    if (String(state.appointments[i].id) === String(updated.id)) {
                        state.appointments[i] = updated;
                        break;
                    }
                }

                showAlert('success', 'Staff assigned successfully.');
                applySearchFilterAndRender();
                renderAppointmentDetails(updated);
                return;
            }

            showAlert('error', (res && res.message) ? res.message : 'Failed to assign staff.');
        }).fail(function (xhr) {
            if (xhr && xhr.status === 401) {
                return;
            }

            var msg = 'Failed to assign staff.';
            try {
                var parsed = xhr.responseJSON;
                if (parsed && parsed.message) {
                    msg = parsed.message;
                }
            } catch (e) {}
            showAlert('error', msg);
        }).always(function () {
            $btn.prop('disabled', false).text('Assign Staff');
        });
    }

    function bindEvents() {
        global.jQuery('#status').on('change', function () {
            var status = global.jQuery(this).val();
            CURRENT_PAGE = 1;
            loadAppointments();
        });

        // Clear button resets all filters and shows most recent
        global.jQuery('#btn-clear').on('click', function () {
            global.jQuery('#status').val('all');
            global.jQuery('#search').val('');
            CURRENT_PAGE = 1;
            loadAppointments();
        });

        global.jQuery('#btn-prev').on('click', function () {
            if (CURRENT_PAGE > 1) {
                CURRENT_PAGE -= 1;
                loadAppointments();
            }
        });

        global.jQuery('#btn-next').on('click', function () {
            CURRENT_PAGE += 1;
            loadAppointments();
        });

        // Search filters client-side (on already loaded API results)
        global.jQuery('#search').on('input', function () {
            if (SEARCH_DEBOUNCE_TIMER) {
                clearTimeout(SEARCH_DEBOUNCE_TIMER);
            }
            SEARCH_DEBOUNCE_TIMER = setTimeout(function () {
                applySearchFilterAndRender();
            }, 200);
        });

        global.jQuery(document).on('click', 'button[data-action="view"]', function () {
            var id = global.jQuery(this).data('id');
            setLoading(true);
            fetchAppointment(id).done(function (fresh) {
                if (!fresh) {
                    showAlert('error', 'Failed to load appointment details.');
                    return;
                }

                for (var i = 0; i < state.appointments.length; i++) {
                    if (String(state.appointments[i].id) === String(fresh.id)) {
                        state.appointments[i] = fresh;
                        break;
                    }
                }

                applySearchFilterAndRender();
                renderAppointmentDetails(fresh);
            }).fail(function () {
                showAlert('error', 'Failed to load appointment details.');
            }).always(function () {
                setLoading(false);
            });
        });

        global.jQuery('#assign-staff-btn').on('click', function () {
            assignStaff();
        });
    }

    function init() {
        if (!RoleGuard.requireRole(['admin'])) {
            return;
        }

        bindEvents();

        if (!global.jQuery('#status').val()) {
            global.jQuery('#status').val('all');
        }

        hydrateFiltersFromQuery();

        setLoading(true);
        fetchStaff().always(function () {
            setLoading(false);
            loadAppointments();
        });
    }

    global.AdminAppointments = {
        init: init
    };
})(window);
