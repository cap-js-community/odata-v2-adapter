namespace passenger;

entity CalculationFactors {
    key TRANSPORT_MODE_KEY: String;
    key DIMENSION: String;
    key CLASS: String;
    key COUNTRY_OF_TRIP: String;
    key CURRENCY: String;
    key ALLOCATION_METHOD: String;
    @odata.Type: 'Edm.String'
    key VALID_FROM: Date;
    @odata.Type: 'Edm.String'
    key VALID_TO: Date;
}

service PassengerTransportationService {
    entity CalculationFactors as projection on passenger.CalculationFactors;
}
