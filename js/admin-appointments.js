(function (global) {
    var state = {
        appointments: [],
        staff: [],
        selectedAppointment: null,
        loading: false
    };

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
        if (!iso) {
            return '-';
        }
        var d = new Date(iso);
        if (isNaN(d.getTime())) {
            return '-';
        }
        return d.toLocaleString();
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
            url: Api.getBaseUrl() + '/admin/appointments',
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        }).then(function (res) {
            var items = res && res.data && res.data.appointments;
            state.appointments = Array.isArray(items) ? items : [];
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

    function renderAppointmentsTable() {
        var $tbody = global.jQuery('#admin-appointments-tbody');
        $tbody.empty();

        if (!state.appointments.length) {
            global.jQuery('#admin-appointments-empty').removeClass('hidden');
            return;
        }

        global.jQuery('#admin-appointments-empty').addClass('hidden');

        state.appointments.forEach(function (a) {
            var status = AppointmentRules.normalizeStatus(a.status);
            var statusColor = AppointmentRules.getStatusBadgeColor(status);

            var customer = a.user && a.user.name ? a.user.name : '-';
            var vehicle = a.vehicle && a.vehicle.full_name ? a.vehicle.full_name : '-';
            var staff = a.staff && a.staff.name ? a.staff.name : 'Unassigned';

            var row = '<tr>'
                + '<td class="px-6 py-4 whitespace-nowrap text-sm">' + escapeHtml(formatDate(a.appointment_date)) + '</td>'
                + '<td class="px-6 py-4 whitespace-nowrap text-sm">' + escapeHtml(customer) + '</td>'
                + '<td class="px-6 py-4 whitespace-nowrap text-sm">' + escapeHtml(vehicle) + '</td>'
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
                renderAppointmentsTable();
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

                renderAppointmentsTable();
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

        setLoading(true);
        global.jQuery.when(fetchStaff(), fetchAppointments())
            .done(function () {
                renderAppointmentsTable();
            })
            .fail(function () {
                showAlert('error', 'Failed to load admin appointments.');
            })
            .always(function () {
                setLoading(false);
            });
    }

    global.AdminAppointments = {
        init: init
    };
})(window);
