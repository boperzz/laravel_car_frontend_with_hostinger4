(function (global) {
    var STATUS = {
        PENDING: 'pending',
        IN_PROGRESS: 'in_progress',
        COMPLETED: 'completed',
        CANCELLED: 'cancelled'
    };

    function normalizeStatus(status) {
        if (!status) {
            return '';
        }
        return String(status).toLowerCase();
    }

    function getStatusBadgeColor(status) {
        var s = normalizeStatus(status);
        if (s === STATUS.COMPLETED) {
            return 'green';
        }
        if (s === STATUS.PENDING) {
            return 'yellow';
        }
        return 'blue';
    }

    function hasAssignedStaff(appointment) {
        if (!appointment) {
            return false;
        }

        if (appointment.staff && appointment.staff.id) {
            return true;
        }

        return !!appointment.staff_id;
    }

    function isEditableForStaffAssignment(status) {
        return normalizeStatus(status) === STATUS.PENDING;
    }

    function getStaffAssignmentLockReason(appointment) {
        if (!appointment) {
            return 'missing_appointment';
        }

        if (hasAssignedStaff(appointment)) {
            return 'already_assigned';
        }

        if (!isEditableForStaffAssignment(appointment.status)) {
            return 'status_locked';
        }

        return null;
    }

    function isStaffAssignmentLocked(appointment) {
        return !!getStaffAssignmentLockReason(appointment);
    }

    global.AppointmentRules = {
        STATUS: STATUS,
        normalizeStatus: normalizeStatus,
        getStatusBadgeColor: getStatusBadgeColor,
        hasAssignedStaff: hasAssignedStaff,
        isEditableForStaffAssignment: isEditableForStaffAssignment,
        getStaffAssignmentLockReason: getStaffAssignmentLockReason,
        isStaffAssignmentLocked: isStaffAssignmentLocked
    };
})(window);
