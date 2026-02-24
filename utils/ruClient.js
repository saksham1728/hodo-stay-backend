const fetch = require('node-fetch');
const { XMLParser, XMLBuilder } = require('fast-xml-parser');

const RU_BASE_URL = 'https://rm.rentalsunited.com/api/Handler.ashx';
const RU_USERNAME = process.env.RU_USERNAME || 'hello.dhilshadh@gmail.com';
const RU_PASSWORD = process.env.RU_PASSWORD || 'HodoStays@12';

const xmlParser = new XMLParser();
const xmlBuilder = new XMLBuilder();

class RentalsUnitedClient {
    constructor() {
        this.baseUrl = RU_BASE_URL;
        this.username = RU_USERNAME;
        this.password = RU_PASSWORD;
    }

    wrapXml(body) {
        return `<?xml version="1.0" encoding="utf-8"?>${body}`;
    }

    async makeRequest(xmlBody) {
        try {
            console.log('Sending XML Request:', xmlBody);

            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'User-Agent': 'Hodo-Stay-Backend/1.0',
                    'content': 'application/xml',
                    'accept': 'application/xml'
                },
                body: xmlBody // Send XML without wrapping
            });

            const responseText = await response.text();
            console.log('Raw Response:', responseText);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${responseText}`);
            }

            return responseText;
        } catch (error) {
            console.error('RU API Error:', error);
            throw error;
        }
    }

    // 1. List Properties in a Location (Pull_ListProp_RQ)
    async pullListProp(locationId, includeNLA = false) {
        const xmlBody = `<Pull_ListProp_RQ>
 <Authentication>
   <UserName>${this.username}</UserName>
   <Password>${this.password}</Password>
 </Authentication>
 <LocationID>${locationId}</LocationID>
 <IncludeNLA>${includeNLA}</IncludeNLA>
</Pull_ListProp_RQ>`;

        return await this.makeRequest(xmlBody);
    }

    // 2. Get Property Details (Pull_ListSpecProp_RQ)
    async pullListSpecProp(propertyId, currency = 'USD') {
        const xmlBody = `<Pull_ListSpecProp_RQ>
 <Authentication>
   <UserName>${this.username}</UserName>
   <Password>${this.password}</Password>
 </Authentication>
 <PropertyID>${propertyId}</PropertyID>
 <Currency>${currency}</Currency>
</Pull_ListSpecProp_RQ>`;

        return await this.makeRequest(xmlBody);
    }

    // 3. Get Availability & Price Quote (Pull_GetPropertyAvbPrice_RQ)
    async pullGetPropertyAvbPrice(propertyId, dateFrom, dateTo, nop = null, currency = 'USD') {
        let xmlBody = `<Pull_GetPropertyAvbPrice_RQ>
 <Authentication>
   <UserName>${this.username}</UserName>
   <Password>${this.password}</Password>
 </Authentication>
 <PropertyID>${propertyId}</PropertyID>
 <DateFrom>${dateFrom}</DateFrom>
 <DateTo>${dateTo}</DateTo>`;

        if (nop) {
            xmlBody += `\n <NOP>${nop}</NOP>`;
        }

        xmlBody += `\n <Currency>${currency}</Currency>
</Pull_GetPropertyAvbPrice_RQ>`;

        return await this.makeRequest(xmlBody);
    }

    // 4. Get Reservations List (Pull_ListReservations_RQ)
    async pullListReservations(dateFrom, dateTo, locationId = 0) {
        const xmlBody = `<Pull_ListReservations_RQ>
 <Authentication>
   <UserName>${this.username}</UserName>
   <Password>${this.password}</Password>
 </Authentication>
 <DateFrom>${dateFrom}</DateFrom>
 <DateTo>${dateTo}</DateTo>
 <LocationID>${locationId}</LocationID>
 <Statuses>
   <StatusID>1</StatusID>
   <StatusID>2</StatusID>
   <StatusID>3</StatusID>
   <StatusID>4</StatusID>
 </Statuses>
</Pull_ListReservations_RQ>`;

        return await this.makeRequest(xmlBody);
    }

    // 5. Create Confirmed Reservation (Push_PutConfirmedReservationMulti_RQ)
    async pushPutConfirmedReservation(reservationData) {
        const xmlBody = `<Push_PutConfirmedReservationMulti_RQ><Authentication><UserName>${this.username}</UserName><Password>${this.password}</Password></Authentication><Reservation><StayInfos><StayInfo><PropertyID>${reservationData.propertyId}</PropertyID><DateFrom>${reservationData.dateFrom}</DateFrom><DateTo>${reservationData.dateTo}</DateTo><NumberOfGuests>${reservationData.numberOfGuests}</NumberOfGuests><Costs><RUPrice>${reservationData.ruPrice}</RUPrice><ClientPrice>${reservationData.clientPrice}</ClientPrice><AlreadyPaid>${reservationData.alreadyPaid}</AlreadyPaid></Costs></StayInfo></StayInfos><CustomerInfo><Name>${reservationData.customerName}</Name><SurName>${reservationData.customerSurname}</SurName><Email>${reservationData.customerEmail}</Email><Phone>${reservationData.customerPhone || ''}</Phone></CustomerInfo><Comments>${reservationData.comments || ''}</Comments></Reservation></Push_PutConfirmedReservationMulti_RQ>`;

        return await this.makeRequest(xmlBody);
    }

    // 6. Create Confirmed Reservation (Full Version)
    async pushPutConfirmedReservationMulti(reservationData) {
        const xmlBody = `<Push_PutConfirmedReservationMulti_RQ>
 <Authentication>
   <UserName>${this.username}</UserName>
   <Password>${this.password}</Password>
 </Authentication>
 <Reservation>
   <StayInfos>
     <StayInfo>
       <PropertyID>${reservationData.propertyId}</PropertyID>
       <DateFrom>${reservationData.dateFrom}</DateFrom>
       <DateTo>${reservationData.dateTo}</DateTo>
       <NumberOfGuests>${reservationData.numberOfGuests}</NumberOfGuests>
       <Costs>
         <RUPrice>${reservationData.ruPrice}</RUPrice>
         <ClientPrice>${reservationData.clientPrice}</ClientPrice>
         <AlreadyPaid>${reservationData.alreadyPaid}</AlreadyPaid>
         <ChannelCommission>0.00</ChannelCommission>
       </Costs>
     </StayInfo>
   </StayInfos>
   <CustomerInfo>
     <Name>${reservationData.customerName}</Name>
     <SurName>${reservationData.customerSurname}</SurName>
     <Email>${reservationData.customerEmail}</Email>
     <Phone>${reservationData.customerPhone || ''}</Phone>
     ${reservationData.customerAddress ? `<Address>${reservationData.customerAddress}</Address>` : ''}
     ${reservationData.customerZipCode ? `<ZipCode>${reservationData.customerZipCode}</ZipCode>` : ''}
   </CustomerInfo>
   ${reservationData.comments ? `<Comments>${reservationData.comments}</Comments>` : ''}
 </Reservation>
</Push_PutConfirmedReservationMulti_RQ>`;

        return await this.makeRequest(xmlBody);
    }

    // 7. Cancel Reservation (Push_CancelReservation_RQ)
    async pushCancelReservation(reservationId, cancelTypeId = 2) {
        const xmlBody = `<Push_CancelReservation_RQ>
 <Authentication>
   <UserName>${this.username}</UserName>
   <Password>${this.password}</Password>
 </Authentication>
 <ReservationID>${reservationId}</ReservationID>
 <CancelTypeID>${cancelTypeId}</CancelTypeID>
</Push_CancelReservation_RQ>`;

        return await this.makeRequest(xmlBody);
    }

    // 8. Get Property Availability Calendar (Pull_ListPropertyAvailabilityCalendar_RQ)
    async pullListPropertyAvailabilityCalendar(propertyId, dateFrom, dateTo) {
        const xmlBody = `<Pull_ListPropertyAvailabilityCalendar_RQ>
 <Authentication>
   <UserName>${this.username}</UserName>
   <Password>${this.password}</Password>
 </Authentication>
 <PropertyID>${propertyId}</PropertyID>
 <DateFrom>${dateFrom}</DateFrom>
 <DateTo>${dateTo}</DateTo>
</Pull_ListPropertyAvailabilityCalendar_RQ>`;

        return await this.makeRequest(xmlBody);
    }

    // 9. Get Property Prices (Pull_ListPropertyPrices_RQ)
    async pullListPropertyPrices(propertyId, dateFrom, dateTo, pricingModelMode = 0) {
        const xmlBody = `<Pull_ListPropertyPrices_RQ>
 <Authentication>
   <UserName>${this.username}</UserName>
   <Password>${this.password}</Password>
 </Authentication>
 <PropertyID>${propertyId}</PropertyID>
 <DateFrom>${dateFrom}</DateFrom>
 <DateTo>${dateTo}</DateTo>
 <PricingModelMode>${pricingModelMode}</PricingModelMode>
</Pull_ListPropertyPrices_RQ>`;

        return await this.makeRequest(xmlBody);
    }

    // 10. Register Webhook URL (LNM_PutHandlerUrl_RQ)
    async registerWebhook(handlerUrl) {
        const xmlBody = `<LNM_PutHandlerUrl_RQ>
 <Authentication>
   <UserName>${this.username}</UserName>
   <Password>${this.password}</Password>
 </Authentication>
 <HandlerUrl>${handlerUrl}</HandlerUrl>
</LNM_PutHandlerUrl_RQ>`;

        return await this.makeRequest(xmlBody);
    }

    // 11. Unregister Webhook (send without HandlerUrl)
    async unregisterWebhook() {
        const xmlBody = `<LNM_PutHandlerUrl_RQ>
 <Authentication>
   <UserName>${this.username}</UserName>
   <Password>${this.password}</Password>
 </Authentication>
</LNM_PutHandlerUrl_RQ>`;

        return await this.makeRequest(xmlBody);
    }
}

module.exports = new RentalsUnitedClient();