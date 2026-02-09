class ApiResponse {
    constructor(success, data = null, message = '', meta = null) {
        this.success = success;
        this.data = data;
        this.message = message;
        this.meta = meta;
        this.timestamp = new Date().toISOString();
    }

    static success(data = null, message = 'Success', meta = null) {
        return new ApiResponse(true, data, message, meta);
    }

    static error(message = 'Error', data = null) {
        return new ApiResponse(false, data, message);
    }

    static paginate(data, pagination) {
        return new ApiResponse(true, data, 'Success', { pagination });
    }
}

module.exports = ApiResponse;