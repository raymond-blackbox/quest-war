/**
 * Formats a paginated response with consistent metadata.
 * @param {Array} data - The data items for the current page.
 * @param {number} totalCount - Total items available across all pages.
 * @param {number} limit - Items per page.
 * @param {number} offset - Current offset.
 */
export const formatPaginatedResponse = (data, totalCount, limit, offset) => {
    return {
        data,
        pagination: {
            total: totalCount,
            limit,
            offset,
            hasMore: offset + data.length < totalCount,
            totalPages: Math.ceil(totalCount / limit)
        }
    };
};
