const PROPERTY_GURU = "https://www.propertyguru.com.sg"

module.exports = {
    PROPERTY_GURU: PROPERTY_GURU,
    CONDO_DIRECTORY: PROPERTY_GURU + "/condo-directory/search/params",
    PROPERTY_DETAIL_SELECTOR: {
        noOfBedrooms: "#details .head-bed .hidden-xs",
        noOfBathrooms: "#details .head-bath .hidden-xs",
        agentName: "#contact-form-side .agent-contact-details .agency-name",
        agentLicense: "#contact-form-side .agent-details-container .agent-license",
        agentContactNumber: "#contact-form-side .agent-phone-number",
        agentContainer: "#contact-form-side .agent-details-container .list-group-item-heading",
        address: "#details .listing-address",
        askingPrice: "#details .listing-price-value",
        askingPriceType: "#details .listing-price-type",
        tableRow: "#details .table tbody tr",
        listingURL: "#shareListingEmail [name='url']",
        paginationNext: ".main-content .pagination .pagination-next.disabled",
        propertyItem: ".main-content .listings-page-results .row .listing-info a"
    }
}