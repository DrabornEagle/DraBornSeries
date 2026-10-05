import React from "react";
import { Image, Text, View } from "react-native";
import { Button, Icon, colors, styles } from "./theme";
import { AccentButton } from "./ActionRow";
export default function ProfilePhotoPicker({ uri, onPick, onRemove, optional = false }: {
  uri?: string; onPick: () => void; onRemove: () => void; optional?: boolean;
}) {
  return <View style={{ gap: 12 }}>
    <Text style={styles.label}>Profil fotoğrafı{optional ? " · İsteğe bağlı" : ""}</Text>
    <View style={[styles.row, { gap: 18, flexWrap: "wrap" }]}>
      <View style={{ width: 76, height: 76, borderRadius: 25, backgroundColor: "#392343", alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 1, borderColor: "#e94d9e80" }}>
        {uri ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} /> : <Icon name="person-outline" size={32} color={colors.purple} />}
      </View>
      <View style={{ flex: 1, minWidth: 180, gap: 8 }}>
        <AccentButton small testID="profile-photo-picker" icon="image-outline" gradient={["#277daa", "#6853cf", "#ca409c"]} onPress={onPick}>Cihazdan fotoğraf seç</AccentButton>
        {!!uri && <Button secondary small icon="close" onPress={onRemove}>Fotoğrafı kaldır</Button>}
      </View>
    </View>
    <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>Yalnızca seçtiğin görsel yüklenir; kare olarak hazırlanır. Kaydedildiğinde Android ve web profilinde görünür ve herkese açık bağlantıda saklanır.</Text>
  </View>;
}
