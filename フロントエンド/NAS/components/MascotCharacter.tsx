import React, { useEffect, useRef } from 'react';
// 1. StyleProp と ImageStyle を追加でインポート
import { Animated, ImageStyle, StyleProp, StyleSheet } from 'react-native';

// 2. Propsの型を定義する（styleは必須ではないので「?」をつけています）
type MascotProps = {
  style?: StyleProp<ImageStyle>;
};

// 3. 引数に型を適用する
export default function MascotCharacter({ style }: MascotProps) {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // ふわふわ上下アニメーション
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -12,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 呼吸っぽいスケールアニメーション
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.05,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.Image
      source={require('./assets/images/mascot.png')} // 透過PNG
      style={[
        styles.mascot,
        style,
        {
          transform: [
            { translateY: floatAnim },
            { scale: scaleAnim },
          ],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  mascot: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
  },
});