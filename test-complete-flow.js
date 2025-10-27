async function testCompleteFlow() {
  try {
    console.log('🎯 Complete Hodo Stay Backend Flow Test\n');
    
    const baseURL = 'http://localhost:5000/api';
    
    // Step 1: Test Buildings API
    console.log('1️⃣ Testing Buildings API...');
    const buildingsResponse = await fetch(`${baseURL}/buildings`);
    const buildingsData = await buildingsResponse.json();
    
    if (buildingsData.success && buildingsData.data.buildings.length > 0) {
      const building = buildingsData.data.buildings[0];
      console.log(`   ✅ Found building: ${building.name}`);
      console.log(`   📊 Units available: ${building.availableUnits}`);
      
      // Step 2: Test Building Details API
      console.log('\n2️⃣ Testing Building Details API...');
      const buildingDetailResponse = await fetch(`${baseURL}/buildings/${building.buildingId}`);
      const buildingDetailData = await buildingDetailResponse.json();
      
      if (buildingDetailData.success && buildingDetailData.data.building.units.length > 0) {
        const unit = buildingDetailData.data.building.units[0];
        console.log(`   ✅ Found unit: ${unit.name}`);
        console.log(`   🏠 Unit ID: ${unit._id}`);
        
        // Step 3: Test Unit Details API
        console.log('\n3️⃣ Testing Unit Details API...');
        const unitDetailResponse = await fetch(`${baseURL}/units/${unit._id}`);
        const unitDetailData = await unitDetailResponse.json();
        
        if (unitDetailData.success) {
          console.log(`   ✅ Unit details loaded: ${unitDetailData.data.unit.name}`);
          
          // Step 4: Test User Creation
          console.log('\n4️⃣ Testing User Creation...');
          const userData = {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com',
            phone: '+1234567890',
            address: {
              street: '123 Main St',
              city: 'New York',
              state: 'NY',
              zipCode: '10001',
              country: 'USA'
            }
          };
          
          const userResponse = await fetch(`${baseURL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
          });
          const userResult = await userResponse.json();
          
          if (userResult.success) {
            console.log(`   ✅ User created: ${userResult.data.user.fullName}`);
            
            // Step 5: Test Booking Creation
            console.log('\n5️⃣ Testing Booking Creation...');
            const bookingData = {
              userId: userResult.data.user._id,
              unitId: unit._id,
              checkInDate: '2025-01-15',
              checkOutDate: '2025-01-18',
              guests: {
                adults: 2,
                children: 0
              },
              pricing: {
                basePrice: 100,
                nights: 3,
                subtotal: 300,
                taxes: 30,
                fees: {
                  cleaningFee: 25,
                  serviceFee: 15
                },
                totalAmount: 370,
                currency: 'USD'
              },
              guestInfo: {
                firstName: 'John',
                lastName: 'Doe',
                email: 'john.doe@example.com',
                phone: '+1234567890'
              },
              specialRequests: 'Late check-in requested'
            };
            
            const bookingResponse = await fetch(`${baseURL}/bookings`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(bookingData)
            });
            const bookingResult = await bookingResponse.json();
            
            if (bookingResult.success) {
              console.log(`   ✅ Booking created: ${bookingResult.data.booking.bookingReference}`);
              console.log(`   💰 Total amount: $${bookingResult.data.booking.pricing.totalAmount}`);
              
              // Step 6: Test Booking Retrieval
              console.log('\n6️⃣ Testing Booking Retrieval...');
              const bookingId = bookingResult.data.booking._id;
              const getBookingResponse = await fetch(`${baseURL}/bookings/${bookingId}`);
              const getBookingResult = await getBookingResponse.json();
              
              if (getBookingResult.success) {
                console.log(`   ✅ Booking retrieved: ${getBookingResult.data.booking.bookingReference}`);
                console.log(`   📅 Dates: ${new Date(getBookingResult.data.booking.checkInDate).toDateString()} - ${new Date(getBookingResult.data.booking.checkOutDate).toDateString()}`);
                
                console.log('\n🎉 COMPLETE FLOW TEST SUCCESSFUL!');
                console.log('\n📋 API Endpoints Working:');
                console.log('   ✅ GET /api/buildings - List property groups');
                console.log('   ✅ GET /api/buildings/:id - Building details with units');
                console.log('   ✅ GET /api/units/:id - Unit details');
                console.log('   ✅ POST /api/users - Create/get user');
                console.log('   ✅ POST /api/bookings - Create booking');
                console.log('   ✅ GET /api/bookings/:id - Get booking details');
                
                console.log('\n🚀 Ready for Frontend Integration!');
                
              } else {
                console.log('   ❌ Booking retrieval failed');
              }
            } else {
              console.log('   ❌ Booking creation failed:', bookingResult.message);
            }
          } else {
            console.log('   ❌ User creation failed:', userResult.message);
          }
        } else {
          console.log('   ❌ Unit details failed');
        }
      } else {
        console.log('   ❌ Building details failed');
      }
    } else {
      console.log('   ❌ Buildings API failed - need to sync data first');
      console.log('   💡 Try: GET /api/buildings?forceSync=true');
    }
    
  } catch (error) {
    console.error('❌ Flow test failed:', error.message);
  }
}

// Run the complete flow test
testCompleteFlow();