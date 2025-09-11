# Adding Products to Your Site — Summary (S&S PromoStandards Developer Guide 2022)

> This markdown condenses **Part 1: “Adding Products to Your Site”** with practical notes and the **exact XML snippets** shown in the guide for Inventory 2.0.0, Product Data 2.0.0, and Pricing & Configuration 1.0.0.

---

## What this section says (at a glance)

- Build a sellable catalog by **combining three PromoStandards services** per style:
  1) **Product Data 2.0.0** — style master + variants (attributes, sizes, colors, GTIN, packaging, flags).
  2) **Pricing & Configuration 1.0.0** — prices per **FOB/warehouse** (`fobId`) and currency.
  3) **Inventory 2.0.0 (recommended)** — real-time warehouse-level stock by **partId**.

- **Identifiers & Auth**
  - `id` = your **S&S account number**
  - `password` = **API key**
  - **Style** identifier = `productId`; **variant** identifier = `partId`
  - The guide’s examples filter styles by using **`B` + style/part number** (e.g., `B00760`).

---

## Practical sync flow

1. **Seed Catalog** — Call **Product Data 2.0.0 (GetProduct)** to load the style master and each variant (`ProductPartArray`).
2. **Attach Prices** — Call **Pricing & Configuration 1.0.0 (GetConfigurationAndPricing)** **per `fobId`** you care about.
3. **Refresh Stock** — Call **Inventory 2.0.0 (GetInventoryLevels)** to populate warehouse-level stock for each `partId`.
4. **Keep Fresh** — Periodically refresh Inventory (most volatile), then Pricing, then Product Data (least volatile).

> **Tip:** If you copy from a PDF, replace any *smart quotes* in XML attributes with straight quotes.

---

## Inventory 2.0.0 — Sample Request

```xml
<soapenv:Header/>
  <soapenv:Body>
      <ns:GetInventoryLevelsRequest>
         <shar:wsVersion>2.0.0</shar:wsVersion>
         <shar:id>{Account Number}</shar:id>
         <shar:password>{API Key}</shar:password>
         <shar:productId>B00760</shar:productId>
      </ns:GetInventoryLevelsRequest>
   </soapenv:Body>


Inventory 2.0.0 — Sample Response (excerpt)
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xmlns:xsd="http://www.w3.org/2001/XMLSchema">
    <GetInventoryLevelsResponse xmlns="http://www.promostandards.org/WSDL/Inventory/2.0.0/">
      <Inventory xmlns="http://www.promostandards.org/WSDL/Inventory/2.0.0/SharedObjects/">
        <productId>2000</productId>
        <PartInventoryArray>
          <PartInventory>
            <partId>B00760033</partId>
            <mainPart>false</mainPart>
            <partColor>Antique Cherry Red</partColor>
            <labelSize>S</labelSize>
            <partDescription>Ultra Cotton® T-Shirt</partDescription>
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
                <Address>
                  <city>Robbinsville</city>
                  <country>US</country>
                  <postalCode>08691</postalCode>
                </Address>
                <inventoryLocationQuantity>
                  <Quantity>
                    <uom>EA</uom>
                    <value>23</value>
                  </Quantity>
                </inventoryLocationQuantity>
              </InventoryLocation>
              <InventoryLocation>
                <inventoryLocationId>KS</inventoryLocationId>
                <inventoryLocationName>Olathe</inventoryLocationName>
                <Address>
                  <city>Olathe</city>
                  <country>US</country>
                  <postalCode>66061</postalCode>
                </Address>
                <inventoryLocationQuantity>
                  <Quantity>
                    <uom>EA</uom>
                    <value>287</value>
                  </Quantity>
                </inventoryLocationQuantity>
              </InventoryLocation>
              <InventoryLocation>
                <inventoryLocationId>DS</inventoryLocationId>
                <inventoryLocationName>Dropship</inventoryLocationName>
                <Address>
                  <city>Bolingbrook</city>
                  <country>US</country>
                  <postalCode>60440</postalCode>
                </Address>
                <inventoryLocationQuantity>
                  <Quantity>
                    <uom>EA</uom>
                    <value>0</value>
                  </Quantity>
                </inventoryLocationQuantity>
              </InventoryLocation>
              <InventoryLocation>
                <inventoryLocationId>TX</inventoryLocationId>
                <inventoryLocationName>Fort Worth</inventoryLocationName>
                <Address>
                  <city>Fort Worth</city>
                  <country>US</country>
                  <postalCode>76137</postalCode>
                </Address>
                <inventoryLocationQuantity>
                  <Quantity>
                    <uom>EA</uom>
                    <value>71</value>
                  </Quantity>
                </inventoryLocationQuantity>
              </InventoryLocation>
              <InventoryLocation>
                <inventoryLocationId>GA</inventoryLocationId>
                <inventoryLocationName>McDonough</inventoryLocationName>
                <Address>
                  <city>McDonough</city>
                  <country>US</country>
                  <postalCode>30253</postalCode>
                </Address>
                <inventoryLocationQuantity>
                  <Quantity>
                    <uom>EA</uom>
                    <value>130</value>
                  </Quantity>
                </inventoryLocationQuantity>
              </InventoryLocation>
              <InventoryLocation>
                <inventoryLocationId>NV</inventoryLocationId>
                <inventoryLocationName>Reno</inventoryLocationName>
                <Address>
                  <city>Reno</city>
                  <country>US</country>
                  <postalCode>89506</postalCode>
                </Address>
                <inventoryLocationQuantity>
                  <Quantity>
                    <uom>EA</uom>
                    <value>16</value>
                  </Quantity>
                </inventoryLocationQuantity>
              </InventoryLocation>
              <InventoryLocation>
                <inventoryLocationId>IL</inventoryLocationId>
                <inventoryLocationName>Lockport</inventoryLocationName>
                <Address>
                  <city>Lockport</city>
                  <country>US</country>
                  <postalCode>60441</postalCode>
                </Address>
                <inventoryLocationQuantity>
                  <Quantity>
                    <uom>EA</uom>
                    <value>157</value>
                  </Quantity>
                </inventoryLocationQuantity>
              </InventoryLocation>
            </InventoryLocationArray>
          </PartInventory>
        </PartInventoryArray>
      </Inventory>
    </GetInventoryLevelsResponse>
  </s:Body>
</s:Envelope>

Product Data 2.0.0 — Sample Response (excerpt)
<GetProductResponse xmlns="http://www.promostandards.org/WSDL/ProductData/2.0.0/">
  <Product>
    <ProductPriceGroupArray>
      <ProductPriceGroup>
        <groupName>CatalogPrice</groupName>
        <currency>USD</currency>
        <description>Catalog Pricing</description>
      </ProductPriceGroup>
    </ProductPriceGroupArray>
    <ProductPartArray>
      <ProductPart>
        <partId>B00760037</partId>
        <ColorArray>
          <Color>
            <hex>#971B2F</hex>
            <approximatePms>7427</approximatePms>
            <colorName>Antique Cherry Red</colorName>
          </Color>
        </ColorArray>
        <ApparelSize>
          <apparelStyle>Unisex</apparelStyle>
          <labelSize>2XL</labelSize>
        </ApparelSize>
        <Dimension>
          <dimensionUom>MM</dimensionUom>
          <depth xsi:nil="true"/>
          <height xsi:nil="true"/>
          <width xsi:nil="true"/>
          <weightUom>OZ</weightUom>
          <weight>0.5500</weight>
        </Dimension>
        <gtin>00821780008151</gtin>
        <isRushService>false</isRushService>
        <ShippingPackageArray>
          <ShippingPackage>
            <packageType>Box</packageType>
            <quantity>72</quantity>
            <dimensionUom>IN</dimensionUom>
            <depth>23.7500</depth>
            <height>13.2500</height>
            <width>16.2500</width>
            <weightUom>LB</weightUom>
            <weight>41.50</weight>
          </ShippingPackage>
        </ShippingPackageArray>
        <endDate xsi:nil="true"/>
        <effectiveDate xsi:nil="true"/>
        <isCloseout>false</isCloseout>
        <isCaution>false</isCaution>
        <isOnDemand>false</isOnDemand>
        <isHazmat>false</isHazmat>
      </ProductPart>
    </ProductPartArray>
    <lastChangeDate>2020-11-17T14:44:46.333</lastChangeDate>
    <creationDate>2020-11-17T14:44:46.333</creationDate>
    <endDate xsi:nil="true"/>
    <effectiveDate xsi:nil="true"/>
    <isCaution xsi:nil="true"/>
    <isCloseout>false</isCloseout>
  </Product>
</GetProductResponse>

Pricing & Configuration 1.0.0 — Sample Request
<soapenv:Header/>
   <soapenv:Body>
      <ns:GetConfigurationAndPricingRequest>
         <shar:wsVersion>1.0.0</shar:wsVersion>
         <shar:id>{Account Number}</shar:id>
         <shar:password>{API Key}</shar:password>
         <shar:productId>B00760</shar:productId>
         <shar:currency>USD</shar:currency>
         <shar:fobId>IL</shar:fobId>
         
         
         \<shar:priceType>Customer</shar:priceType>
         <shar:localizationCountry>US</shar:localizationCountry>
         <shar:localizationLanguage>en</shar:localizationLanguage>
         <shar:configurationType>Blank</shar:configurationType>
      </ns:GetConfigurationAndPricingRequest>
   </soapenv:Body>

Pricing & Configuration 1.0.0 — Sample Response (excerpt)
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
    <GetConfigurationAndPricingResponse xmlns="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/">
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
                <priceEffectiveDate>2020-11-18T00:00:00-06:00</priceEffectiveDate>
                <priceExpiryDate>2020-11-20T00:00:00</priceExpiryDate>
              </PartPrice>
            </PartPriceArray>
            <partGroup>1</partGroup>
            <partGroupRequired>true</partGroupRequired>
            <partGroupDescription>Main Product</partGroupDescription>
            <ratio>1</ratio>
            <defaultPart>true</defaultPart>
          </Part>
        </PartArray>
        <productId>2000</productId>
        <currency>USD</currency>
        <FobArray>
          <Fob><fobId>NJ</fobId><fobPostalCode>08691</fobPostalCode></Fob>
          <Fob><fobId>KS</fobId><fobPostalCode>66061</fobPostalCode></Fob>
          <Fob><fobId>DS</fobId><fobPostalCode>60440</fobPostalCode></Fob>
          <Fob><fobId>TX</fobId><fobPostalCode>76137</fobPostalCode></Fob>
          <Fob><fobId>GA</fobId><fobPostalCode>30253</fobPostalCode></Fob>
          <Fob><fobId>NV</fobId><fobPostalCode>89506</fobPostalCode></Fob>
          <Fob><fobId>IL</fobId><fobPostalCode>60441</fobPostalCode></Fob>
        </FobArray>
        <priceType>Customer</priceType>
      </Configuration>
    </GetConfigurationAndPricingResponse>
  </s:Body>
</s:Envelope>

Implementation notes & reminders

Inventory: Quantities are provided per warehouse under InventoryLocationArray (e.g., NJ, KS, DS, TX, GA, NV, IL). Each location also has a postal code you can use for shipping quotes.

Pricing: Scope is per fobId. Run a separate pricing call for each warehouse you display in the UI or use for freight estimates.

Product Data: Includes ProductPartArray for sellable partIds and rich attributes like color (hex/PMS), size label, packaging and shipping weights/dimensions, GTIN, and status flags (e.g., isCloseout, isOnDemand, isHazmat).

Sync cadence: Inventory most frequent; Pricing moderate cadence; Product Data least frequent unless you detect lastChangeDate.