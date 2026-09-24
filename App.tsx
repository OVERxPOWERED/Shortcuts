import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Image,
  DeviceEventEmitter,
  NativeModules,
} from 'react-native'
import React, { useEffect, useState, useRef } from 'react'
import SplashScreen from './components/SplashScreen';
import ShortcutSettingPanel from './components/ShortcutSettingPanel';
import ShortcutList from './components/ShortcutList';
import { showBubble } from './components/BubbleInitializer';
import showBubbleIcon from './assets/bubble_icon.png';
import  useBubbleClickListner  from './components/useBubbleClickListner';
import { MMKV } from 'react-native-mmkv';


const storage = new MMKV();

export default function App() {

  const [modalVisible, setModalVisible] = useState(false);

  const [bubbleVisibility, setBubbleVisibility] = useState(false); // save

  const [shortcutLists, setShortcutLists] = useState({ // save
    "Single-Tap": [],
    "Double-Tap": [],
    "Triple-Tap": [],
  });

  const [activeShortcuts, setActiveShortcuts] = useState({ // save
    "Single-Tap": null,
    "Double-Tap": null,
    "Triple-Tap": null,
  });

  
  useEffect(() => {
    const savedBubbleVisibility = storage.getString('bubbleVisibility');
    const savedShortcutLists = storage.getString('shortcutLists');
    const savedActiveShortcuts = storage.getString('activeShortcuts');
  
    if (savedBubbleVisibility !== undefined) {
      setBubbleVisibility(JSON.parse(savedBubbleVisibility));
    }
  
    if (savedShortcutLists !== undefined) {
      setShortcutLists(JSON.parse(savedShortcutLists));
    }
  
    if (savedActiveShortcuts !== undefined) {
      setActiveShortcuts(JSON.parse(savedActiveShortcuts));
    }
  }, []);

  const [actionRadioValue, setActionRadioValue] = useState("Single-Tap");
  const [taskRadioValue, setTaskRadioValue] = useState("Launch App");

  const [selectedApp, setSelectedApp] = useState("Calculator");
  const [selectedAppPackageName, setSelectedAppPackageName] = useState('com.miui.calculator');

  const [selectedSetting, setSelectedSetting] = useState("Airplane Mode");

  function handleCancel() {
    setModalVisible(false);
  }

  function handleSave(action, newShortcut) {
    try {
      setShortcutLists((prev) => ({
        ...prev,
        [action]: [...prev[action], newShortcut],
      }));
      setModalVisible(false);
    } catch (err) {
      console.error("Save error:", err);
    }
  }

  function setShortcut(action, shortcut) {
    setActiveShortcuts((prev) => ({
      ...prev,
      [action]: shortcut,
    }));
  }

  function handleShortcutDelete(action, index) {
    setShortcutLists((prev) => {
      const updatedList = prev[action].filter((_, i) => i !== index);
      return { ...prev, [action]: updatedList };
    });

    setActiveShortcuts((prev) => {
      const isDeletingActive = prev[action] && shortcutLists[action][index]?.packageName === prev[action]?.packageName;
      return isDeletingActive ? { ...prev, [action]: null } : prev;
    });
  }

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('floating-bubble-remove', () => {
      setBubbleVisibility(false);
    });

    return () => sub.remove(); // Clean up on unmount
  }, []);

  useBubbleClickListner(activeShortcuts['Single-Tap'],activeShortcuts['Double-Tap'],activeShortcuts['Triple-Tap']);

  useEffect(() => {
    storage.set('bubbleVisibility', JSON.stringify(bubbleVisibility));
  }, [bubbleVisibility]);
  
  useEffect(() => {
    storage.set('shortcutLists', JSON.stringify(shortcutLists));
  }, [shortcutLists]);
  
  useEffect(() => {
    storage.set('activeShortcuts', JSON.stringify(activeShortcuts));
  }, [activeShortcuts]);



return (
  <View style={Style.body}>
    <SplashScreen />
    <View style={Style.topBar}>
      <Text style={Style.topBarText} >Shortcuts</Text>
    </View>

    <ShortcutSettingPanel
      modalVisible={modalVisible}
      setModalVisible={setModalVisible}
      actionRadioValue={actionRadioValue}
      setActionRadioValue={setActionRadioValue}
      taskRadioValue={taskRadioValue}
      setTaskRadioValue={setTaskRadioValue}
      selectedSetting={selectedSetting}
      setSelectedSetting={setSelectedSetting}
      selectedApp={selectedApp}
      setSelectedApp={setSelectedApp}
      selectedAppPackageName={selectedAppPackageName}
      setSelectedAppPackageName={setSelectedAppPackageName}
      handleCancel={handleCancel}
      handleSave={handleSave} />
    <View style={Style.container}>

      <ShortcutList
        shortcuts={shortcutLists["Single-Tap"]}
        shortcutListTitle={"Single-Tap"}
        setShortcut={setShortcut}
        activeShortcut={activeShortcuts["Single-Tap"]}
        handleDelete={handleShortcutDelete}
      />
      <ShortcutList
        shortcuts={shortcutLists["Double-Tap"]}
        shortcutListTitle={"Double-Tap"}
        setShortcut={setShortcut}
        activeShortcut={activeShortcuts["Double-Tap"]}
        handleDelete={handleShortcutDelete}
      />
      <ShortcutList
        shortcuts={shortcutLists["Triple-Tap"]}
        shortcutListTitle={"Triple-Tap"}
        setShortcut={setShortcut}
        activeShortcut={activeShortcuts["Triple-Tap"]}
        handleDelete={handleShortcutDelete}
      />

      <View style={Style.bubbleButtonWrapper}>
        <Text style={Style.instruction}>Click to Add a Bubble 👉 </Text>
        <Pressable onPress={() => { showBubble(bubbleVisibility, setBubbleVisibility); }} style={Style.bubbleButton}>
          <Image source={showBubbleIcon} style={Style.bubbleIcon} />
        </Pressable>
      </View>


      <View style={Style.addButtonWrapper}>

        <Text style={Style.instruction}>Click to Add a Shortcut 👉 </Text>

        <Pressable onPress={() => { setModalVisible(true) }} style={Style.add}>
          <Text style={Style.addText} > + </Text>
        </Pressable>

      </View>
    </View>
  </View>
)
}

const Style = StyleSheet.create({
  body: {
    flex: 1,
    backgroundColor: '#000'
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderRadius: 12,
  },
  topBar: {
    height: 80,
    width: '100%',
    backgroundColor: '#000',
    // backgroundColor: '#fff',
    // experimental_backgroundImage: 'linear-gradient(to bottom, #fff, #000)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarText: {
    color: '#fff',
    fontSize: 30,
    marginTop: 30,
  },
  bubbleButtonWrapper: {
    width: '100%',
    height: 80,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'absolute',
    bottom: 110,
  },
  bubbleButton: {
    height: 65,
    width: 65,
    borderWidth: 2,
    borderRadius: 50,
    marginRight: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubbleIcon: {
    width: 65,
    height: 65,
  },
  addButtonWrapper: {
    width: '100%',
    height: 80,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'absolute',
    bottom: 30,
  },
  add: {
    backgroundColor: '#000',
    height: 50,
    width: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 30,
  },
  addText: {
    color: '#fff',
    fontSize: 30,
    marginBottom: 5,
  },
  instruction: {
    fontSize: 20,
    color: 'rgb(120, 120, 120)',
    marginLeft: 30,
  },
})