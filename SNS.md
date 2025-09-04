S&S Activewear PromoStandards API Integration Guide
This guide provides a comprehensive overview for developers integrating with the S&S Activewear PromoStandards interface. It covers everything from fetching product data and placing orders to tracking shipments and retrieving media.

1. Introduction & Authentication
Before you can start making calls, you need to get your credentials.

WSDL URLs: Available at promostandards.ssactivewear.com

Supported Versions: A full list can be found at promostandards.org/endpoint/overview/company/76/

Authentication
To access the API, you need your S&S account number and an API key.

Username: Your S&S Account Number.

API Key: To obtain your API key, email api@ssactivewear.com. Important: Include your account number in the subject line of the email for faster processing.

All requests require your credentials to be passed in the SOAP body.

<shar:id>{Your Account Number}</shar:id>
<shar:password>{Your API Key}</shar:password>

2. Adding Products to Your Site
To display products, you'll primarily use the Inventory and Product Data services.

Inventory Service (v2.0.0)
It is highly recommended to use version 2.0.0 of the Inventory Service to pull stock levels by warehouse. The productId is typically the style number prefixed with a "B".

Sample Inventory Request
<soapenv:Envelope xmlns:soapenv="[http://schemas.xmlsoap.org/soap/envelope/](http://schemas.xmlsoap.org/soap/envelope/)" xmlns:ns="[http://www.promostandards.org/WSDL/Inventory/2.0.0/](http://www.promostandards.org/WSDL/Inventory/2.0.0/)" xmlns:shar="[http://www.promostandards.org/WSDL/Inventory/2.0.0/SharedObjects/](http://www.promostandards.org/WSDL/Inventory/2.0.0/SharedObjects/)">
   <soapenv:Header/>
   <soapenv:Body>
      <ns:GetInventoryLevelsRequest>
         <shar:wsVersion>2.0.0</shar:wsVersion>
         <shar:id>{Account Number}</shar:id>
         <shar:password>{API Key}</shar:password>
         <shar:productId>B00760</shar:productId>
      </ns:GetInventoryLevelsRequest>
   </soapenv:Body>
</soapenv:Envelope>

Sample Inventory Response
The response provides a PartInventoryArray containing each specific part (color/size combination), its total quantity available, and a breakdown of quantity per warehouse location.

<s:Envelope xmlns:s="[http://schemas.xmlsoap.org/soap/envelope/](http://schemas.xmlsoap.org/soap/envelope/)">
    <s:Body xmlns:xsi="[http://www.w3.org/2001/XMLSchema-instance](http://www.w3.org/2001/XMLSchema-instance)" xmlns:xsd="[http://www.w3.org/2001/XMLSchema](http://www.w3.org/2001/XMLSchema)">
        <GetInventoryLevelsResponse xmlns="[http://www.promostandards.org/WSDL/Inventory/2.0.0/](http://www.promostandards.org/WSDL/Inventory/2.0.0/)">
            <Inventory xmlns="[http://www.promostandards.org/WSDL/Inventory/2.0.0/SharedObjects/](http://www.promostandards.org/WSDL/Inventory/2.0.0/SharedObjects/)">
                <productId>2000</productId>
                <PartInventoryArray>
                    <PartInventory>
                        <partId>B00760033</partId>
                        <mainPart>false</mainPart>
                        <partColor>Antique Cherry Red</partColor>
                        <labelSize>S</labelSize>
                        <partDescription>Ultra Cotton T-Shirt</partDescription>
                        <quantityAvailable>
                            <Quantity>
                                <uom>EA</uom>
                                <value>684</value>
                            </Quantity>
                        </quantityAvailable>
                        <manufacturedItem>false</manufacturedItem>
                        <InventoryLocationArray>
                            <InventoryLocation>
                                <inventoryLocationId>NJ</inventoryLocationId>
                                <inventoryLocationName>Robbinsville</inventoryLocationName>
                                <inventoryLocationQuantity>
                                    <Quantity>
                                        <uom>EA</uom>
                                        <value>23</value>
                                    </Quantity>
                                </inventoryLocationQuantity>
                            </InventoryLocation>
                            <!-- ... more locations ... -->
                        </InventoryLocationArray>
                    </PartInventory>
                </PartInventoryArray>
            </Inventory>
        </GetInventoryLevelsResponse>
    </s:Body>
</s:Envelope>

Product Data Service (v2.0.0)
This service provides basic product information, including descriptions, brand, categories, and image URLs. Note: The pricing returned from this service is the base catalog price. For your account-specific pricing, you must use the Pricing and Configuration service.

Sample Product Data Request
<soapenv:Envelope xmlns:soapenv="[http://schemas.xmlsoap.org/soap/envelope/](http://schemas.xmlsoap.org/soap/envelope/)" xmlns:ns="[http://www.promostandards.org/WSDL/ProductData/2.0.0/](http://www.promostandards.org/WSDL/ProductData/2.0.0/)" xmlns:shar="[http://www.promostandards.org/WSDL/ProductData/2.0.0/SharedObjects/](http://www.promostandards.org/WSDL/ProductData/2.0.0/SharedObjects/)">
   <soapenv:Header/>
   <soapenv:Body>
      <ns:GetProductRequest>
         <shar:wsVersion>2.0.0</shar:wsVersion>
         <shar:id>{Account Number}</shar:id>
         <shar:password>{API Key}</shar:password>
         <shar:localizationCountry>US</shar:localizationCountry>
         <shar:localizationLanguage>en</shar:localizationLanguage>
         <shar:productId>B00760</shar:productId>
      </ns:GetProductRequest>
   </soapenv:Body>
</soapenv:Envelope>

Sample Product Data Response
<s:Envelope xmlns:s="[http://schemas.xmlsoap.org/soap/envelope/](http://schemas.xmlsoap.org/soap/envelope/)">
    <s:Body>
        <GetProductResponse>
            <Product>
                <productId>2000</productId>
                <productName>Ultra Cotton T-Shirt-2000</productName>
                <description>
                    <![CDATA[<ul><li>6 oz. (US) 10 oz. (CA), 100% preshrunk cotton</li>...</ul>]]>
                </description>
                <productBrand>Gildan</productBrand>
                <primaryImageUrl>Images/Style/39.jpg</primaryImageUrl>
                <!-- ... other product details ... -->
                <ProductPartArray>
                    <ProductPart>
                        <partId>B00760037</partId>
                        <!-- ... part details like color, size, weight ... -->
                    </ProductPart>
                </ProductPartArray>
            </Product>
        </GetProductResponse>
    </s:Body>
</s:Envelope>

3. Pricing
To get your account-specific pricing, use the GetConfigurationAndPricing service. This call is warehouse-specific, so you must specify a fobId (e.g., 'IL', 'NJ', 'KS') in your request. You will need to make a separate call for each warehouse.

Sample Pricing Request
<soapenv:Envelope xmlns:soapenv="[http://schemas.xmlsoap.org/soap/envelope/](http://schemas.xmlsoap.org/soap/envelope/)" xmlns:ns="[http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/](http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/)" xmlns:shar="[http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/SharedObjects/](http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/SharedObjects/)">
   <soapenv:Header/>
   <soapenv:Body>
      <ns:GetConfigurationAndPricingRequest>
         <shar:wsVersion>1.0.0</shar:wsVersion>
         <shar:id>{Account Number}</shar:id>
         <shar:password>{API Key}</shar:password>
         <shar:productId>B00760</shar:productId>
         <shar:currency>USD</shar:currency>
         <shar:fobId>IL</shar:fobId>
         <shar:priceType>Customer</shar:priceType>
         <shar:localizationCountry>US</shar:localizationCountry>
         <shar:localizationLanguage>en</shar:localizationLanguage>
         <shar:configurationType>Blank</shar:configurationType>
      </ns:GetConfigurationAndPricingRequest>
   </soapenv:Body>
</soapenv:Envelope>

Sample Pricing Response
The response contains a list of partIds with their associated cost from the specified FOB point.

<s:Envelope xmlns:s="[http://schemas.xmlsoap.org/soap/envelope/](http://schemas.xmlsoap.org/soap/envelope/)">
    <s:Body xmlns:xsi="[http://www.w3.org/2001/XMLSchema-instance](http://www.w3.org/2001/XMLSchema-instance)" xmlns:xsd="[http://www.w3.org/2001/XMLSchema](http://www.w3.org/2001/XMLSchema)">
        <GetConfigurationAndPricingResponse xmlns="[http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/](http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/)">
            <Configuration>
                <PartArray>
                    <Part>
                        <partId>B00760033</partId>
                        <partDescription>Antique Cherry Red (S)</partDescription>
                        <PartPriceArray>
                            <PartPrice>
                                <minQuantity>1</minQuantity>
                                <price>2.50</price>
                                <discountCode>A</discountCode>
                                <priceUom>EA</priceUom>
                            </PartPrice>
                        </PartPriceArray>
                    </Part>
                </PartArray>
                <FobArray>
                    <Fob>
                        <fobId>IL</fobId>
                        <fobPostalCode>60441</fobPostalCode>
                    </Fob>
                    <!-- ... other FOB points ... -->
                </FobArray>
            </Configuration>
        </GetConfigurationAndPricingResponse>
    </s:Body>
</s:Envelope>

4. Placing an Order (Purchase Order)
The SendPO service allows you to programmatically place orders.

Purchase Order Requirements
Order Type: Must be set to Blank. No other types are accepted.

Order Number: Your internal PO number for the order.

Order Contact: You must include an OrderContactArray of type Order. This contact will receive all order-related emails and must include an email address.

Shipments: Only one shipment is allowed per order. This shipment configuration will apply to all warehouses the order ships from.

Line Items: The lineType for all items must be New.

Quantity UOM: All quantities must be submitted with a unit of measure (UOM) of EA.

Accepted Shipping Services:

UPS: UPS GROUND, UPS NEXTDAY, UPS NEXTDAYEARLYAM, UPS NEXTDAYSAVER, UPS 2DAY, UPS 2DAYAM, UPS 3DAY, UPS SUREPOST, UPS SATURDAY, UPS SATURDAYEARLY

FedEx: FEDEX GROUND, FEDEX 2DAY, FEDEX NEXTDAY, FEDEX NEXTDAYPRIORITY

Other: WILLCALL, MESSANGER, MISC CHEAPEST

Third-Party Shipping: To use your own shipping account, provide the accountNumber in the FreightDetails. S&S will use this number if it matches the specified carrier.

Sample Purchase Order Request
<soapenv:Envelope xmlns:soapenv="[http://schemas.xmlsoap.org/soap/envelope/](http://schemas.xmlsoap.org/soap/envelope/)" xmlns:ns="[http://www.promostandards.org/WSDL/PO/1.0.0/](http://www.promostandards.org/WSDL/PO/1.0.0/)" xmlns:shar="[http://www.promostandards.org/WSDL/PO/1.0.0/SharedObjects/](http://www.promostandards.org/WSDL/PO/1.0.0/SharedObjects/)">
   <soapenv:Header/>
   <soapenv:Body>
      <ns:SendPORequest>
         <shar:wsVersion>1.0.0</shar:wsVersion>
         <shar:id>{S&S Account Number}</shar:id>
         <shar:password>{S&S API Key}</shar:password>
         <ns:PO>
            <ns:orderType>Blank</ns:orderType>
            <ns:orderNumber>12345678</ns:orderNumber>
            <ns:orderDate>2020-10-26T12:00:00</ns:orderDate>
            <ns:OrderContactArray>
               <!-- ... Contact Details ... -->
            </ns:OrderContactArray>
            <ns:ShipmentArray>
               <!-- ... Shipment Details ... -->
            </ns:ShipmentArray>
            <ns:LineItemArray>
               <ns:LineItem>
                  <ns:lineNumber>1</ns:lineNumber>
                  <ns:lineType>New</ns:lineType>
                  <shar:Quantity>
                     <shar:uom>EA</shar:uom>
                     <shar:value>2</shar:value>
                  </shar:Quantity>
                  <ns:PartArray>
                    <shar:Part>
                        <shar:partId>B00760004</shar:partId>
                        <!-- ... More Part Details ... -->
                    </shar:Part>
                  </ns:PartArray>
               </ns:LineItem>
            </ns:LineItemArray>
         </ns:PO>
      </ns:SendPORequest>
   </soapenv:Body>
</soapenv:Envelope>

Sample Purchase Order Response
Upon success, the transactionId in the response will be the S&S order number.

<s:Envelope xmlns:s="[http://schemas.xmlsoap.org/soap/envelope/](http://schemas.xmlsoap.org/soap/envelope/)">
    <s:Body xmlns:xsi="[http://www.w3.org/2001/XMLSchema-instance](http://www.w3.org/2001/XMLSchema-instance)" xmlns:xsd="[http://www.w3.org/2001/XMLSchema](http://www.w3.org/2001/XMLSchema)">
        <SendPOResponse xmlns="[http://www.promostandards.org/WSDL/PO/1.0.0/](http://www.promostandards.org/WSDL/PO/1.0.0/)">
            <transactionId>30070919</transactionId>
            <ServiceMessageArray xmlns="[http://www.promostandards.org/WSDL/PO/1.0.0/SharedObjects/](http://www.promostandards.org/WSDL/PO/1.0.0/SharedObjects/)">
                <ServiceMessage>
                    <code>299</code>
                    <description>
                        S&amp;S Promostandards Purchase Order - Successfull&lt;br/&gt;
                        &lt;br/&gt;PO Number: 12345678&lt;br/&gt;&lt;br/&gt;Order Number: 87654321
                    </description>
                    <severity>Information</severity>
                </ServiceMessage>
            </ServiceMessageArray>
        </SendPOResponse>
    </s:Body>
</s:Envelope>

5. Order Updates and Tracking
Order Status Service
Use the GetOrderStatusDetails service to check the status of an order. It's recommended to query by the S&S invoiceNumber (which corresponds to welreferenceNumber in the request), as an order may be split across multiple warehouses and have multiple invoices.

Supported Statuses
Order Received

Order Confirmed

General Hold

Credit Hold

In Production

Complete

Canceled

Sample Order Status Request
Here, queryType 2 corresponds to querying by Purchase Order Number.

<soapenv:Envelope xmlns:soapenv="[http://schemas.xmlsoap.org/soap/envelope/](http://schemas.xmlsoap.org/soap/envelope/)" xmlns:ns="[http://www.promostandards.org/WSDL/OrderStatusService/1.0.0/](http://www.promostandards.org/WSDL/OrderStatusService/1.0.0/)" xmlns:shar="[http://www.promostandards.org/WSDL/OrderStatusService/1.0.0/SharedObjects/](http://www.promostandards.org/WSDL/OrderStatusService/1.0.0/SharedObjects/)">
   <soapenv:Header/>
   <soapenv:Body>
      <ns:GetOrderStatusDetailsRequest>
         <ns:wsVersion>1.0.0</ns:wsVersion>
         <shar:id>{Account Number}</shar:id>
         <shar:password>{API Key}</shar:password>
         <ns:queryType>2</ns:queryType>
         <ns:referenceNumber>12345678</ns:referenceNumber>
      </ns:GetOrderStatusDetailsRequest>
   </soapenv:Body>
</soapenv:Envelope>

Order Shipment Notification Service
This service provides detailed shipment information, including tracking numbers and package contents, for a given order.

Sample Shipment Notification Request
<soapenv:Envelope xmlns:soapenv="[http://schemas.xmlsoap.org/soap/envelope/](http://schemas.xmlsoap.org/soap/envelope/)" xmlns:ns="[http://www.promostandards.org/WSDL/OrderShipmentNotificationService/1.0.0/](http://www.promostandards.org/WSDL/OrderShipmentNotificationService/1.0.0/)" xmlns:shar="[http://www.promostandards.org/WSDL/OrderShipmentNotificationService/1.0.0/SharedObjects/](http://www.promostandards.org/WSDL/OrderShipmentNotificationService/1.0.0/SharedObjects/)">
   <soapenv:Header/>
   <soapenv:Body>
      <ns:GetOrderShipmentNotificationRequest>
         <shar:wsVersion>1.0.0</shar:wsVersion>
         <shar:id>{Account Number}</shar:id>
         <shar:password>{API Key}</shar:password>
         <ns:queryType>2</ns:queryType>
         <ns:referenceNumber>12345678</ns:referenceNumber>
      </ns:GetOrderShipmentNotificationRequest>
   </soapenv:Body>
</soapenv:Envelope>

6. Invoices
Invoices are generated after an order has been completed by a warehouse. You can query for invoices using the GetInvoices service. It's often best to query by date to find all recently invoiced orders.

Sample Invoice Request
<soapenv:Envelope xmlns:soapenv="[http://schemas.xmlsoap.org/soap/envelope/](http://schemas.xmlsoap.org/soap/envelope/)" xmlns:shar="[http://www.promostandards.org/WSDL/Invoice/1.0.0/SharedObjects/](http://www.promostandards.org/WSDL/Invoice/1.0.0/SharedObjects/)" xmlns:ns="[http://www.promostandards.org/WSDL/Invoice/1.0.0/](http://www.promostandards.org/WSDL/Invoice/1.0.0/)">
   <soapenv:Header/>
   <soapenv:Body>
      <ns:GetInvoicesRequest>
         <shar:wsVersion>1.0.0</shar:wsVersion>
         <shar:id>{Account Number}</shar:id>
         <shar:password>{API Key}</shar:password>
         <shar:queryType>2</shar:queryType>
         <shar:referenceNumber>12345678</shar:referenceNumber>
      </ns:GetInvoicesRequest>
   </soapenv:Body>
</soapenv:Envelope>

7. Images and Media
The GetMediaContent service provides URLs for product images and other documents like spec sheets.

Image URL Notes
The image URLs returned by the API are intended for download purposes only, not for direct hotlinking in production environments.

Image names often end in _fs, _fm, or _fl, corresponding to small (130x163), medium (300x375), and large (1000x1250) sizes. You can adjust the suffix to get the desired size.

For PNG images, simply replace .jpg with .png in the URL.

Bulk image downloads are available via the S&S DataLibrary (for medium-sized images) or an FTP site. Email api@ssactivewear.com to request FTP access.

Sample Media Content Request
<soapenv:Envelope xmlns:soapenv="[http://schemas.xmlsoap.org/soap/envelope/](http://schemas.xmlsoap.org/soap/envelope/)" xmlns:ns="[http://www.promostandards.org/WSDL/MediaService/1.0.0/](http://www.promostandards.org/WSDL/MediaService/1.0.0/)" xmlns:shar="[http://www.promostandards.org/WSDL/MediaService/1.0.0/SharedObjects/](http://www.promostandards.org/WSDL/MediaService/1.0.0/SharedObjects/)">
   <soapenv:Header/>
   <soapenv:Body>
      <ns:GetMediaContentRequest>
         <shar:wsVersion>1.0.0</shar:wsVersion>
         <shar:id>{Account Number}</shar:id>
         <shar:password>{API Key}</shar:password>
         <shar:mediaType>Image</shar:mediaType>
         <shar:productId>B00760</shar:productId>
      </ns:GetMediaContentRequest>
   </soapenv:Body>
</soapenv:Envelope>

Sample Media Content Response
<s:Envelope xmlns:s="[http://schemas.xmlsoap.org/soap/envelope/](http://schemas.xmlsoap.org/soap/envelope/)">
    <s:Body xmlns:xsi="[http://www.w3.org/2001/XMLSchema-instance](http://www.w3.org/2001/XMLSchema-instance)" xmlns:xsd="[http://www.w3.org/2001/XMLSchema](http://www.w3.org/2001/XMLSchema)">
        <GetMediaContentResponse xmlns="[http://www.promostandards.org/WSDL/MediaService/1.0.0/](http://www.promostandards.org/WSDL/MediaService/1.0.0/)">
            <MediaContentArray>
                <MediaContent>
                    <productId>2000</productId>
                    <partId>B00760563</partId>
                    <url>[https://cdn.ssactivewear.com/images/color/17074_f_fl.jpg](https://cdn.ssactivewear.com/images/color/17074_f_fl.jpg)</url>
                    <mediaType>Image</mediaType>
                    <ClassTypeArray>
                        <ClassType>
                            <classTypeId>1007</classTypeId>
                            <classTypeName>Front</classTypeName>
                        </ClassType>
                    </ClassTypeArray>
                    <color>Azalea</color>
                </MediaContent>
                <!-- ... more media content ... -->
            <
            /MediaContentArray>
        </GetMediaContentResponse>
    </s:Body>
</s:Envelope>