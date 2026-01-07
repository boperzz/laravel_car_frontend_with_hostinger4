(function (global) {
    'use strict';

    function parseDate(value) {
        if (!value) return null;

        // Accept Date objects directly
        if (value instanceof Date) {
            return isNaN(value.getTime()) ? null : value;
        }

        var d = new Date(value);
        if (isNaN(d.getTime())) {
            return null;
        }
        return d;
    }

    function pad(n) {
        n = Number(n);
        if (isNaN(n)) return '00';
        return n < 10 ? '0' + n : String(n);
    }

    /**
     * Format a date/time value as a universal string in the format:
     * YYYY-MM-DD HH:mm:ss
     */
    function formatDateTime(value) {
        var d = parseDate(value);
        if (!d) return '—';

        var year = d.getFullYear();
        var month = pad(d.getMonth() + 1);
        var day = pad(d.getDate());
        var hours = pad(d.getHours());
        var minutes = pad(d.getMinutes());
        var seconds = pad(d.getSeconds());

        return year + '-' + month + '-' + day + ' ' + hours + ':' + minutes + ':' + seconds;
    }

    /**
     * Format a time-only value (keeps the same time component as formatDateTime)
     * HH:mm:ss
     */
    function formatTime(value) {
        var d = parseDate(value);
        if (!d) return '—';

        var hours = pad(d.getHours());
        var minutes = pad(d.getMinutes());
        var seconds = pad(d.getSeconds());

        return hours + ':' + minutes + ':' + seconds;
    }

    /**
     * Format a date value as MM/DD/YYYY (for appointment dates)
     * Example: 12/25/2024
     */
    function formatDate(value) {
        var d = parseDate(value);
        if (!d) return '—';

        var month = pad(d.getMonth() + 1);
        var day = pad(d.getDate());
        var year = d.getFullYear();

        return month + '/' + day + '/' + year;
    }

    /**
     * Format a date and time value as MM/DD/YYYY HH:mm
     * Example: 12/25/2024 14:30
     */
    function formatDateTimeShort(value) {
        var d = parseDate(value);
        if (!d) return '—';

        var month = pad(d.getMonth() + 1);
        var day = pad(d.getDate());
        var year = d.getFullYear();
        var hours = pad(d.getHours());
        var minutes = pad(d.getMinutes());

        return month + '/' + day + '/' + year + ' ' + hours + ':' + minutes;
    }

    global.DateUtils = {
        parseDate: parseDate,
        formatDateTime: formatDateTime,
        formatTime: formatTime,
        formatDate: formatDate,
        formatDateTimeShort: formatDateTimeShort
    };
})(window);


