# Brief Email to S&S Activewear API Support

**Subject:** PromoStandards Pricing API - 400 Bad Request Error

---

**To:** S&S Activewear API Support  
**Account:** 944527  
**API Key:** 663f142b-1a2d-4c68-a2cf-88e032f092e3  

---

## Issue

Our **PromoStandards Pricing & Configuration 1.0.0** calls are failing with **400 Bad Request**, while Product Data 2.0.0 works perfectly with the same credentials.

## What We Need to Know

**Endpoint:** `https://promostandards.ssactivewear.com/pricingandconfiguration/v1/pricingandconfigurationservice.svc`

**Questions:**
1. **Is our account (944527) enabled for PromoStandards pricing access?**
2. **Is this the correct pricing endpoint URL?**
3. **Are there additional authentication requirements for pricing vs product data?**
4. **Can you test a pricing call with our credentials and confirm what's wrong?**

**SOAP Request Sample:**
```xml
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" 
                  xmlns:ns="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/" 
                  xmlns:shar="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/SharedObjects/">
   <soapenv:Body>
      <ns:GetConfigurationAndPricingRequest>
         <shar:wsVersion>1.0.0</shar:wsVersion>
         <shar:id>944527</shar:id>
         <shar:password>663f142b-1a2d-4c68-a2cf-88e032f092e3</shar:password>
         <shar:productId>B00760</shar:productId>
         <shar:currency>USD</shar:currency>
         <shar:fobId>IL</shar:fobId>
         <shar:priceType>Customer</shar:priceType>
         <shar:configurationType>Blank</shar:configurationType>
      </ns:GetConfigurationAndPricingRequest>
   </soapenv:Body>
</soapenv:Envelope>
```

**Error:** HTTP 400 Bad Request (empty response body)

Thanks for your help!

InkIQ Development Team
