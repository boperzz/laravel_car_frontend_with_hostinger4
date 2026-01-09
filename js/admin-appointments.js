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
        // Use the new formatDate function for MM/DD/YYYY format
        if (global.DateUtils && typeof global.DateUtils.formatDate === 'function') {
            return global.DateUtils.formatDate(iso);
        }

        // Fallback if DateUtils is not loaded
        if (!iso) {
            return '—';
        }
        var d = new Date(iso);
        if (isNaN(d.getTime())) {
            return '—';
        }
        var month = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        var year = d.getFullYear();
        return month + '/' + day + '/' + year;
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

            // Extract date and time from appointment_date
            var date = formatDate(a.appointment_date);
            var time = '—';
            if (a.appointment_date) {
                try {
                    var dateStr = String(a.appointment_date);
                    var timeStr = '';
                    
                    // Handle space-separated format (e.g., "2026-01-23 08:00" or "2026-01-23 08:00:00")
                    if (dateStr.indexOf(' ') !== -1) {
                        var parts = dateStr.split(' ');
                        if (parts.length > 1) {
                            // Extract HH:mm from the time part (remove seconds if present)
                            timeStr = parts[1].substring(0, 5); // Extract HH:mm
                        }
                    }
                    // Handle ISO format with 'T' separator (e.g., "2026-01-23T08:00" or "2026-01-23T08:00:00Z")
                    else if (dateStr.indexOf('T') !== -1) {
                        var timePart = dateStr.split('T')[1];
                        if (timePart) {
                            // Remove timezone info (Z, +HH:mm, -HH:mm) and extract HH:mm
                            timeStr = timePart.replace(/[Z+-].*$/, '').substring(0, 5);
                        }
                    }
                    
                    // Validate and set time (must be HH:mm format)
                    if (timeStr && timeStr.length === 5 && /^\d{2}:\d{2}$/.test(timeStr)) {
                        time = timeStr;
                    }
                } catch (e) {
                    console.warn('Error extracting time from appointment_date:', e);
                    time = '—';
                }
            }

            var row = '<tr data-action="view" data-id="' + escapeHtml(a.id) + '">'
                + '<td class="px-6 py-4 whitespace-nowrap text-sm">' + escapeHtml(date) + '</td>'
                + '<td class="px-6 py-4 whitespace-nowrap text-sm">' + escapeHtml(time) + '</td>'
                + '<td class="px-6 py-4 whitespace-nowrap text-sm">' + escapeHtml(customer) + '</td>'
                + '<td class="px-6 py-4 whitespace-nowrap text-sm">' + escapeHtml(vehicle) + '</td>'
                + '<td class="px-6 py-4 text-sm">' + escapeHtml(servicesText || '-') + '</td>'
                + '<td class="px-6 py-4 whitespace-nowrap">'
                + '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-' + statusColor + '-100 text-' + statusColor + '-800">'
                + escapeHtml(status ? (status.charAt(0).toUpperCase() + status.slice(1)) : '-')
                + '</span>'
                + '</td>'
                + '<td class="px-6 py-4 whitespace-nowrap text-sm">' + escapeHtml(staff) + '</td>'
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
        var $noStaffWarning = global.jQuery('#admin-no-staff-warning');

        if (lockReason) {
            $assignBox.addClass('hidden');
            $lockBanner.removeClass('hidden');
            $noStaffWarning.addClass('hidden');
        } else {
            $lockBanner.addClass('hidden');
            $assignBox.removeClass('hidden');
            // Check staff availability for this appointment
            checkStaffAvailability(appointment);
        }

        // Show/hide cancel button based on status
        var status = (appointment.status || '').toLowerCase();
        var $cancelSection = global.jQuery('#admin-cancel-section');
        if (status === 'cancelled') {
            $cancelSection.addClass('hidden');
        } else {
            $cancelSection.removeClass('hidden');
        }
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

    function renderStaffOptions(appointment, availableStaff) {
        var $select = global.jQuery('#staff-select');
        $select.empty();

        $select.append('<option value="">Select Staff</option>');

        // If availableStaff is provided, only show available staff
        // Otherwise, show all staff (fallback)
        var staffToShow = availableStaff && availableStaff.length > 0 ? availableStaff : (state.staff || []);

        staffToShow.forEach(function (s) {
            var label = s && (s.name || s.username || s.email) ? (s.name || s.username || s.email) : ('Staff #' + s.id);
            $select.append('<option value="' + escapeHtml(s.id) + '">' + escapeHtml(label) + '</option>');
        });

        if (appointment && appointment.staff && appointment.staff.id) {
            $select.val(String(appointment.staff.id));
        } else {
            $select.val('');
        }
    }

    function checkStaffAvailability(appointment) {
        if (!appointment || !appointment.appointment_date) {
            // If no appointment date, show all staff (fallback)
            renderStaffOptions(appointment);
            global.jQuery('#admin-no-staff-warning').addClass('hidden');
            global.jQuery('#staff-select').prop('disabled', false);
            global.jQuery('#assign-staff-btn').prop('disabled', false).attr('title', '');
            return;
        }

        // Parse appointment date and time
        var appointmentDate = new Date(appointment.appointment_date);
        if (isNaN(appointmentDate.getTime())) {
            renderStaffOptions(appointment);
            global.jQuery('#admin-no-staff-warning').addClass('hidden');
            global.jQuery('#staff-select').prop('disabled', false);
            global.jQuery('#assign-staff-btn').prop('disabled', false).attr('title', '');
            return;
        }

        // Format date and time for API
        // Extract date in YYYY-MM-DD format (local time)
        var year = appointmentDate.getFullYear();
        var month = String(appointmentDate.getMonth() + 1).padStart(2, '0');
        var day = String(appointmentDate.getDate()).padStart(2, '0');
        var dateStr = year + '-' + month + '-' + day;
        
        // Extract time in HH:mm format (local time)
        var hours = String(appointmentDate.getHours()).padStart(2, '0');
        var minutes = String(appointmentDate.getMinutes()).padStart(2, '0');
        var timeStr = hours + ':' + minutes;

        // Calculate duration from services
        var durationMinutes = 60; // Default
        if (appointment.services && appointment.services.length > 0) {
            durationMinutes = appointment.services.reduce(function (sum, s) {
                return sum + (parseInt(s.duration_minutes) || 0);
            }, 0);
        }

        // Build API URL
        var params = ['date=' + encodeURIComponent(dateStr), 'time=' + encodeURIComponent(timeStr)];
        if (durationMinutes > 0) {
            params.push('duration_minutes=' + durationMinutes);
        }
        if (appointment.id) {
            params.push('appointment_id=' + appointment.id);
        }

        var apiUrl = Api.getBaseUrl() + '/admin/staff/available?' + params.join('&');

        // Fetch available staff
        Api.request({
            url: apiUrl,
            method: 'GET'
        }).done(function (res) {
            var availableStaff = (res && res.data && res.data.staff) ? res.data.staff : [];
            var $noStaffWarning = global.jQuery('#admin-no-staff-warning');
            var $staffSelect = global.jQuery('#staff-select');
            var $assignBtn = global.jQuery('#assign-staff-btn');

            if (availableStaff.length === 0) {
                // No staff available - show warning and disable assignment
                $noStaffWarning.removeClass('hidden');
                $staffSelect.prop('disabled', true).empty().append('<option value="">No available staff</option>');
                $assignBtn.prop('disabled', true).attr('title', 'No available staff');
            } else {
                // Staff available - hide warning and enable assignment
                $noStaffWarning.addClass('hidden');
                renderStaffOptions(appointment, availableStaff);
                $staffSelect.prop('disabled', false);
                $assignBtn.prop('disabled', false).attr('title', '');
            }
        }).fail(function (xhr) {
            // On error, fallback to showing all staff
            console.warn('Failed to check staff availability:', xhr);
            renderStaffOptions(appointment);
            global.jQuery('#admin-no-staff-warning').addClass('hidden');
            global.jQuery('#staff-select').prop('disabled', false);
            global.jQuery('#assign-staff-btn').prop('disabled', false).attr('title', '');
        });
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

        // Check if staff assignment is disabled (no available staff)
        var $staffSelect = global.jQuery('#staff-select');
        var $assignBtn = global.jQuery('#assign-staff-btn');
        if ($staffSelect.prop('disabled') || $assignBtn.prop('disabled')) {
            showAlert('error', 'No staff are available for this appointment\'s date and time.');
            return;
        }

        var staffId = global.jQuery('#staff-select').val();
        if (!staffId) {
            showAlert('error', 'Please select a staff member.');
            return;
        }

        var $btn = global.jQuery('#assign-staff-btn');
        $btn.prop('disabled', true).text('Assigning...');

        var staffIdInt = parseInt(staffId, 10);
        if (isNaN(staffIdInt)) {
            showAlert('error', 'Invalid staff ID selected.');
            return;
        }

        Api.request({
            url: Api.getBaseUrl() + '/admin/appointments/' + appointment.id + '/assign-staff',
            method: 'POST',
            contentType: 'application/json',
            processData: false,
            data: JSON.stringify({ staff_id: staffIdInt }),
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
                if (parsed) {
                    if (parsed.message) {
                        msg = parsed.message;
                    } else if (parsed.errors && parsed.errors.staff_id && parsed.errors.staff_id.length > 0) {
                        msg = parsed.errors.staff_id[0];
                    }
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

        // Make table rows clickable to view appointment details
        global.jQuery(document).on('click', '#admin-appointments-tbody tr[data-action="view"]', function (e) {
            // Prevent row click if clicking on interactive elements inside the row
            if (global.jQuery(e.target).is('button, a, input, select, textarea')) {
                return;
            }
            
            // Check if mobile view (screen width < 1024px, which is Tailwind's lg breakpoint)
            var isMobile = global.jQuery(window).width() < 1024;
            
            if (isMobile) {
                // On mobile: scroll down to appointment details panel
                var detailsPanel = global.jQuery('#admin-appointment-details, #admin-appointment-placeholder');
                if (detailsPanel.length) {
                    var offset = detailsPanel.offset();
                    if (offset) {
                        global.jQuery('html, body').animate({
                            scrollTop: offset.top - 20 // 20px offset from top for better visibility
                        }, 300);
                    }
                }
            } else {
                // On desktop: scroll to top of the page
                global.jQuery('html, body').animate({
                    scrollTop: 0
                }, 300);
            }
            
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
                
                // On mobile, scroll to details panel after it's rendered
                if (isMobile) {
                    setTimeout(function() {
                        var detailsPanel = global.jQuery('#admin-appointment-details');
                        if (detailsPanel.length && detailsPanel.is(':visible')) {
                            var offset = detailsPanel.offset();
                            if (offset) {
                                global.jQuery('html, body').animate({
                                    scrollTop: offset.top - 20
                                }, 300);
                            }
                        }
                    }, 100); // Small delay to ensure panel is rendered
                }
            }).fail(function (xhr) {
                if (xhr && xhr.status === 401) {
                    return;
                }
                showAlert('error', 'Failed to load appointment details.');
            }).always(function () {
                setLoading(false);
            });
        });

        global.jQuery('#assign-staff-btn').on('click', function () {
            assignStaff();
        });

        // Use event delegation to ensure handler works even if button is dynamically shown/hidden
        global.jQuery(document).on('click', '#cancel-appointment-btn', function (e) {
            e.preventDefault();
            console.log('Cancel button clicked');
            if (confirm('Are you sure you want to cancel this appointment? This action cannot be undone.')) {
                cancelAppointment();
            }
        });
    }

    function cancelAppointment() {
        console.log('cancelAppointment called');
        var appointment = state.selectedAppointment;
        if (!appointment) {
            console.error('No appointment selected');
            showAlert('error', 'No appointment selected.');
            return;
        }

        console.log('Appointment selected:', appointment.id, 'Status:', appointment.status);

        var status = (appointment.status || '').toLowerCase();
        if (status === 'cancelled') {
            showAlert('error', 'Appointment is already cancelled.');
            return;
        }

        var $btn = global.jQuery('#cancel-appointment-btn');
        $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-2"></i>Cancelling...');

        var url = Api.getBaseUrl() + '/admin/appointments/' + appointment.id + '/status';
        console.log('Sending PATCH request to:', url);

        Api.request({
            url: url,
            method: 'PATCH',
            contentType: 'application/json',
            processData: false,
            data: JSON.stringify({ status: 'cancelled' }),
            headers: { 'Accept': 'application/json' }
        }).done(function (res) {
            console.log('Cancel appointment response:', res);
            if (res && res.success && res.data && res.data.appointment) {
                var updated = res.data.appointment;

                // Update appointment in state
                for (var i = 0; i < state.appointments.length; i++) {
                    if (String(state.appointments[i].id) === String(updated.id)) {
                        state.appointments[i] = updated;
                        break;
                    }
                }

                showAlert('success', res.message || 'Appointment cancelled successfully.');
                applySearchFilterAndRender();
                renderAppointmentDetails(updated);
                return;
            }

            var errorMsg = (res && res.message) ? res.message : 'Failed to cancel appointment.';
            showAlert('error', errorMsg);
        }).fail(function (xhr) {
            console.error('Cancel appointment failed:', xhr);
            if (xhr && xhr.status === 401) {
                return;
            }

            var msg = 'Failed to cancel appointment.';
            try {
                var parsed = xhr.responseJSON;
                if (parsed) {
                    if (parsed.message) {
                        msg = parsed.message;
                    } else if (parsed.errors && typeof parsed.errors === 'object') {
                        var errorKeys = Object.keys(parsed.errors);
                        if (errorKeys.length > 0) {
                            msg = parsed.errors[errorKeys[0]][0] || msg;
                        }
                    }
                }
            } catch (e) {
                console.error('Error parsing response:', e);
            }
            
            if (xhr.status === 0) {
                msg = 'Network error. Please check your connection.';
            } else if (xhr.status === 404) {
                msg = 'Appointment not found.';
            } else if (xhr.status === 403) {
                msg = 'You do not have permission to cancel this appointment.';
            } else if (xhr.status === 500) {
                msg = 'Server error. Please try again later.';
            }
            
            showAlert('error', msg);
        }).always(function () {
            $btn.prop('disabled', false).html('<i class="fas fa-times mr-2"></i>Cancel Appointment');
        });
    }

    function init() {
        if (!RoleGuard.requireRole(['admin', 'super_admin'])) {
            return;
        }

        // Set username in dropdown
        var currentUser = global.Auth && global.Auth.getUser ? global.Auth.getUser() : null;
        if (currentUser && global.jQuery('#user-name').length) {
            global.jQuery('#user-name').text(currentUser.username || currentUser.name || currentUser.email || currentUser.id || 'User');
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
            
            // Auto-refresh appointments every 30 seconds
            setInterval(function() {
                // Only refresh if not currently loading and no modal is open
                if (!state.loading && !state.selectedAppointment) {
                    loadAppointments();
                }
            }, 30000); // 30 seconds
        });
    }

    global.AdminAppointments = {
        init: init
    };
})(window);
