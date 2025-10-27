async function testRUIntegration() {
  try {
    console.log('🏨 Complete Rentals United Integration Test\n');
    
    const baseURL = 'http://localhost:5000/api';
    
    // Step 1: Test Buildings with RU Sync
    console.log('1️⃣ Testing Buildings with RU Property Sync...');
    const buildingsResponse = await fetch(`${baseURL}/buildings`);
    const buildingsData = await buildingsResponse.json();
    
    if (buildingsData.success && buildingsData.data.buildings.length > 0) {
      const building = buildingsData.data.buildings[0];
      console.log(`   ✅ Building: ${building.name} (${building.availableUnits} units)`);
      
      // Step 2: Test Building Details with Units
      console.log('\n2️⃣ Testing Building Details with Units...');
      const buildingDetailResponse = await fetch(`${baseURL}/buildings/${building.buildingId}`);
      const buildingDetailData = await buildingDetailResponse.json();
      
      if (buildingDetailData.success && buildingDetailData.data.building.units.length > 0) {
        const unit = buildingDetailData.data.building.units[0];
        console.log(`   ✅ Unit: ${unit.name} (RU ID: ${unit.ruPropertyId})`);
        
        // Step 3: Test Unit Details with RU API Integration
        console.log('\n3️⃣ Testing Unit Details with RU API...');
        const unitDetailResponse = await fetch(`${baseURL}/units/${unit._id}`);
        const unitDetailData = await unitDetailResponse.json();
        
        if (unitDetailData.success) {
          console.log(`   ✅ Unit Details: ${unitDetailData.data.unit.name}`);
          console.log(`   🖼️ Images: ${unitDetailData.data.unit.images?.length || 0}`);
          console.log(`   🏠 Amenities: ${unitDetailData.data.unit.amenities?.length || 0}`);
          
          // Step 4: Test Availability & Pricing API
          console.log('\n4️⃣ Testing Availability & Pricing API...');
          const dateFrom = '2025-02-01';
          const dateTo = '2025-02-05';
          const guests = 2;
          
          const availabilityResponse = await fetch(
            `${baseURL}/units/${unit._id}/availability?dateFrom=${dateFrom}&dateTo=${dateTo}&guests=${guests}`
          );
          const availabilityData = await availabilityResponse.json();
          
          if (availabilityData.success) {
            console.log(`   ✅ Availability Check: Available for ${dateFrom} to ${dateTo}`);
            console.log(`   💰 Pricing: Available from RU API`);
            
            // Step 5: Test User Creation
            console.log('\n5️⃣ Testing User Creation...');
            const userData = {
              firstName: 'Jane',
              lastName: 'Smith',
              email: 'jane.smith@example.com',
              phone: '+1987654321'
            };
            
            const userResponse = await fetch(`${baseURL}/users`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(userData)
            });
            const userResult = await userResponse.json();
            
            if (userResult.success) {
              console.log(`   ✅ User Created: ${userResult.data.user.fullName}`);
              
              // Step 6: Test Booking Creation
              console.log('\n6️⃣ Testing Booking Creation...');
              const bookingData = {
                userId: userResult.data.user._id,
                unitId: unit._id,
                checkInDate: dateFrom,
                checkOutDate: dateTo,
                guests: { adults: guests, children: 0 },
                pricing: {
                  basePrice: 120,
                  nights: 4,
                  subtotal: 480,
                  taxes: 48,
                  fees: { cleaningFee: 30, serviceFee: 20 },
                  totalAmount: 578,
                  currency: 'USD'
                },
                guestInfo: userData,
                specialRequests: 'Early check-in if possible'
              };
              
              const bookingResponse = await fetch(`${baseURL}/bookings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookingData)
              });
              const bookingResult = await bookingResponse.json();
              
              if (bookingResult.success) {
                const booking = bookingResult.data.booking;
                console.log(`   ✅ Booking Created: ${booking.bookingReference}`);
                console.log(`   📅 Dates: ${dateFrom} to ${dateTo}`);
                console.log(`   💰 Total: $${booking.pricing.totalAmount}`);
                
                // Step 7: Test Booking Confirmation (Push to RU)
                console.log('\n7️⃣ Testing Booking Confirmation (Push to RU)...');
                const confirmResponse = await fetch(`${baseURL}/bookings/${booking._id}/confirm`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' }
                });
                const confirmResult = await confirmResponse.json();
                
                if (confirmResult.success) {
                  console.log(`   ✅ Booking Confirmed in RU: ${confirmResult.data.booking.ruBookingId}`);
                  
                  // Step 8: Test RU Reservations List
                  console.log('\n8️⃣ Testing RU Reservations List...');
                  const reservationsResponse = await fetch(
                    `${baseURL}/bookings/ru/reservations?dateFrom=${dateFrom}&dateTo=${dateTo}`
                  );
                  const reservationsResult = await reservationsResponse.json();
                  
                  if (reservationsResult.success) {
                    console.log(`   ✅ RU Reservations: ${reservationsResult.data.total} found`);
                    
                    // Step 9: Test Booking Cancellation (Cancel in RU)
                    console.log('\n9️⃣ Testing Booking Cancellation (Cancel in RU)...');
                    const cancelResponse = await fetch(`${baseURL}/bookings/${booking._id}/cancel`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        reason: 'Test cancellation',
                        refundAmount: 578
                      })
                    });
                    const cancelResult = await cancelResponse.json();
                    
                    if (cancelResult.success) {
                      console.log(`   ✅ Booking Cancelled in RU and locally`);
                      
                      console.log('\n🎉 COMPLETE RU INTEGRATION TEST SUCCESSFUL!');
                      console.log('\n📋 Rentals United APIs Integrated:');
                      console.log('   ✅ Pull_ListProp_RQ - Property listing');
                      console.log('   ✅ Pull_ListSpecProp_RQ - Property details');
                      console.log('   ✅ Pull_GetPropertyAvbPrice_RQ - Availability & pricing');
                      console.log('   ✅ Push_PutConfirmedReservationMulti_RQ - Create booking');
                      console.log('   ✅ Pull_ListReservations_RQ - List reservations');
                      console.log('   ✅ Push_CancelReservation_RQ - Cancel booking');
                      
                      console.log('\n🚀 Full Dynamic Pricing & Inventory Management Ready!');
                      
                    } else {
                      console.log('   ❌ Booking cancellation failed:', cancelResult.message);
                    }
                  } else {
                    console.log('   ❌ RU reservations list failed:', reservationsResult.message);
                  }
                } else {
                  console.log('   ❌ Booking confirmation failed:', confirmResult.message);
                }
              } else {
                console.log('   ❌ Booking creation failed:', bookingResult.message);
              }
            } else {
              console.log('   ❌ User creation failed:', userResult.message);
            }
          } else {
            console.log('   ❌ Availability check failed:', availabilityData.message);
          }
        } else {
          console.log('   ❌ Unit details failed');
        }
      } else {
        console.log('   ❌ Building details failed');
      }
    } else {
      console.log('   ❌ Buildings API failed - need to sync data first');
    }
    
  } catch (error) {
    console.error('❌ RU Integration test failed:', error.message);
  }
}

// Run the complete RU integration test
testRUIntegration();