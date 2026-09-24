import { StyleSheet, Text, View, Image, Animated } from 'react-native'
import React, { useRef, useEffect, useState } from 'react'
import icon from '../assets/shortcuts_app_icon.png'

export default function SplashScreen() {

  const fadeInAnim = useRef(new Animated.Value(1)).current; // We directly use the current value because, ref returns a mutable object, but we need a constant value.
  // const [fadeInAnim, setfadeInAnim] = useState(new Animated.Value(1)); This works as well
  const [splashVisible, setSplashVisisble] = useState(true);

  useEffect(() => {
    // We used timeout to create a wait before starting fade-out animation
    // .start() is called to begin the animation, it takes a callback function, which is called when the animation is complete
    const timeoutId = setTimeout(() => {
      Animated.timing(fadeInAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      })
        .start(() => {
          setSplashVisisble(false); // Hide splash after animation
        });
    }, 1200);

    return () => clearTimeout(timeoutId);
  }, []);

  const yAxis = useRef(new Animated.Value(50)).current;
  const yAxisImg = useRef(new Animated.Value(-25)).current;
  const opac = useRef(new Animated.Value(0)).current;

  useEffect(() => {

    Animated.timing(yAxis, {
      toValue: 0,
      duration: 800,
      useNativeDriver: true
    }).start();

    Animated.timing(yAxisImg, {
      toValue: 0,
      duration: 800,
      useNativeDriver: true
    }).start();

    Animated.timing(opac, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true
    }).start();

  }, [])

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeInAnim, zIndex: splashVisible ? 5 : -5 }]}>
      <View style={{ ...Style.mainContainer }}>
        <View style={Style.contentBox}>
          <View style={Style.logoBox}>
            <Animated.View style={{ translateY: yAxisImg, opacity: opac }}>
              <Image source={icon} style={Style.icon} />
            </Animated.View>
            <Text style={Style.title}>Shortcuts</Text>
          </View>
          <Animated.View style={{ translateY: yAxis, opacity: opac }}>
            <Text style={Style.credit}>Made By BURHANUDDIN</Text>
            <Text style={Style.credit}>In Partnership with HARSH</Text>
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  )
}

const Style = StyleSheet.create({
  mainContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  logoBox: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    width: 85,
    height: 111,
    marginRight: 10,
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  credit: {
    fontSize: 15,
    fontFamily: 'monospace',
    textAlign: 'center',
  }
})